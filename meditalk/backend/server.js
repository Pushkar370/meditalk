import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

import { initDb, pingDb, getPoolStats, closePool } from './database/db.js';
import { requireAuth, requireRole } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import doctorRoutes from './routes/doctors.js';
import appointmentRoutes from './routes/appointments.js';
import prescriptionRoutes from './routes/prescriptions.js';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import triageRoutes from './routes/triage.js';
import pharmacyRoutes from './routes/pharmacy.js';
import { initJobQueue } from './services/jobQueue.js';


const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'meditalk_dev_secret_2026';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Rate Limiters ───────────────────────────────────────────────────────────
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  // Only skip in automated test environment — never expose a bypassable header
  skip: (req) => process.env.NODE_ENV === 'test',
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => process.env.NODE_ENV === 'test' || req.path === '/api/notifications/stream',
});

// ── Security Headers (Helmet) ───────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Prevents breaking Jitsi iframe or Vite dev scripts
  crossOriginEmbedderPolicy: false,
}));

// ── SSE (Server-Sent Events) Client Registry ─────────────────────────────────
const sseClients = new Map(); // key: userId -> Set of express res objects

export function pushNotification(userId, payload) {
  if (!userId) return;
  const targetId = String(userId);
  const userClients = sseClients.get(targetId);
  if (userClients && userClients.size > 0) {
    const dataString = `data: ${JSON.stringify(payload)}\n\n`;
    for (const clientRes of userClients) {
      try {
        clientRes.write(dataString);
      } catch (e) {
        console.warn('[SSE] Failed to write to client:', e.message);
      }
    }
  }
}

// ── CORS — explicit origin whitelist (never wildcard in production) ─────────
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.FRONTEND_URL,             // e.g. https://meditalk.onrender.com
      'https://meditalk.onrender.com',       // fallback hardcoded prod domain
    ].filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin header) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/api', apiLimiter);

// SSE Stream Endpoint
app.get('/api/notifications/stream', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const userId = String(decoded.userId || decoded.id);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    // Reflect the actual origin rather than wildcarding (credentials require explicit origin)
    'Access-Control-Allow-Origin': req.headers.origin || FRONTEND_URL,
    'Access-Control-Allow-Credentials': 'true',
  });

  // Initial connection greeting
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Register client
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);

  // Also index by decoded.id if different from decoded.userId
  const altId = decoded.id ? String(decoded.id) : null;
  if (altId && altId !== userId) {
    if (!sseClients.has(altId)) {
      sseClients.set(altId, new Set());
    }
    sseClients.get(altId).add(res);
  }

  // Periodic heartbeat every 25s
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (_) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    const userSet = sseClients.get(userId);
    if (userSet) {
      userSet.delete(res);
      if (userSet.size === 0) sseClients.delete(userId);
    }
    if (altId && altId !== userId) {
      const altSet = sseClients.get(altId);
      if (altSet) {
        altSet.delete(res);
        if (altSet.size === 0) sseClients.delete(altId);
      }
    }
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api', prescriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api', pharmacyRoutes);

// Deep Healthcheck Endpoint
app.get('/api/health', async (_req, res) => {
  const dbHealth = await pingDb();
  const poolStats = getPoolStats();
  if (!dbHealth.ok) {
    return res.status(503).json({
      status: 'degraded',
      database: 'unreachable',
      error: dbHealth.error,
      latencyMs: dbHealth.latencyMs,
      pool: poolStats,
      timestamp: new Date().toISOString(),
    });
  }
  res.json({
    status: 'healthy',
    database: 'connected',
    latencyMs: dbHealth.latencyMs,
    pool: poolStats,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Admin System Diagnostics & Telemetry
app.get('/api/admin/system-health', requireAuth, requireRole('admin'), async (_req, res) => {
  const dbHealth = await pingDb();
  const poolStats = getPoolStats();
  const mem = process.memoryUsage();
  let totalSseConnections = 0;
  for (const clientSet of sseClients.values()) {
    totalSseConnections += clientSet.size;
  }

  res.json({
    status: dbHealth.ok ? 'operational' : 'degraded',
    nodeVersion: process.version,
    platform: process.platform,
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbHealth.ok ? 'connected' : 'disconnected',
      latencyMs: dbHealth.latencyMs,
      pool: poolStats,
      error: dbHealth.error || null,
    },
    memory: {
      rssMb: Math.round(mem.rss / (1024 * 1024) * 10) / 10,
      heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024) * 10) / 10,
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024) * 10) / 10,
    },
    activeSseStreams: totalSseConnections,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../dist');
  app.use(express.static(buildPath));
  app.use((req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

export default app;

let server;
async function startServer() {
  try {
    await initDb();

    // Start job queue (pg-boss) — must run after DB is initialized
    try {
      await initJobQueue(process.env.DATABASE_URL);
    } catch (qErr) {
      // Queue failure is non-fatal — app runs without background jobs
      console.warn('⚠️  Job queue failed to start:', qErr.message);
    }

    server = app.listen(PORT, () => {
      console.log(`🚀 MediTalk API running at http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('🔌 HTTP server closed.');
      for (const clientSet of sseClients.values()) {
        for (const clientRes of clientSet) {
          try { clientRes.end(); } catch (_) {}
        }
      }
      sseClients.clear();
      await closePool();
      console.log('✅ Graceful shutdown completed.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('⚠️ Forcefully terminating after timeout.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
