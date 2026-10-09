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

import { JWT_SECRET, getValidatedJwtSecret } from './config/authConfig.js';
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
import messagingRoutes from './routes/messaging.js';
import { initJobQueue } from './services/jobQueue.js';
import { validateInputSizes } from './middleware/inputValidation.js';

export { JWT_SECRET, getValidatedJwtSecret };

const app = express();
// Finding (9): Configure trust proxy so express-rate-limit uses real visitor IP behind Render's reverse proxy
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;
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

// ── Security Headers: Finding (8) Content Security Policy active with safe directives ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "wss:", "ws:", "http://localhost:*", "ws://localhost:*"],
      frameSrc: ["'self'", "https://meet.jit.si"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── SSE (Server-Sent Events) Service ─────────────────────────────────────────
import { sseClients, pushNotification } from './services/sseService.js';
export { pushNotification };

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
    const corsErr = new Error(`CORS: origin '${origin}' not allowed`);
    corsErr.status = 403;
    callback(corsErr);
  },
  credentials: true,
}));

// CORS error handler — return clean 403 Forbidden for disallowed origins
app.use((err, req, res, next) => {
  if (err && err.status === 403 && err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Forbidden — origin not allowed by CORS policy' });
  }
  next(err);
});

// Dynamic body size limiter: 1MB standard, up to 10MB only for medical record upload/OCR
app.use((req, res, next) => {
  const isFileUpload = req.path.includes('/medical-records');
  const limit = isFileUpload ? '10mb' : '1mb';
  express.json({ limit })(req, res, next);
});
app.use((req, res, next) => {
  const isFileUpload = req.path.includes('/medical-records');
  const limit = isFileUpload ? '10mb' : '1mb';
  express.urlencoded({ extended: true, limit })(req, res, next);
});
app.use('/api', apiLimiter);
app.use('/api', validateInputSizes);

// ── Finding (7): SSE Notification Stream (stops accepting URL tokens, validates revocation) ──
app.get('/api/notifications/stream', async (req, res) => {
  // Reject tokens sent in query parameters
  if (req.query.token) {
    return res.status(400).json({
      error: 'Security Notice: Auth tokens in URL query parameters are not permitted. Please provide token via Authorization: Bearer <token> header.',
    });
  }

  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — missing Bearer token' });
  }

  // Strict origin check for SSE stream
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden — origin not allowed' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check token revocation (including token_version session invalidation)
  try {
    const { isTokenRevoked } = await import('./routes/auth.js');
    const revoked = await isTokenRevoked(decoded.jti, decoded.userId || decoded.id, decoded.tokenVersion);
    if (revoked) {
      return res.status(401).json({ error: 'Unauthorized — token has been revoked or session invalidated. Please log in again.' });
    }
  } catch (err) {
    console.error('🔒 [SSE Auth Check Error - Private Log]:', err.message);
    return res.status(401).json({ error: 'Unauthorized — session validation failed' });
  }

  const userId = String(decoded.userId || decoded.id);

  const sseOrigin = (origin && allowedOrigins.includes(origin))
    ? origin
    : (process.env.FRONTEND_URL || 'https://meditalk.onrender.com');

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': sseOrigin,
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
app.use('/api/messaging', messagingRoutes);

// Deep Healthcheck Endpoint
app.get('/api/health', async (_req, res) => {
  const dbHealth = await pingDb();
  const poolStats = getPoolStats();
  if (!dbHealth.ok) {
    return res.status(503).json({
      status: 'degraded',
      database: 'unreachable',
      error: 'Database connection failed',
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
      error: dbHealth.ok ? null : 'Database health check failed',
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

// ── Finding (4): Safe global error handler — NEVER leak err.message to users ──
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      error: 'Payload Too Large: Request body exceeds the maximum permitted size limit of 1MB.',
    });
  }
  // Log internal error details privately on server (with stack trace)
  console.error('🔒 [Internal Server Error - Private Log]:', {
    message: err.message,
    stack: err.stack,
    status: err.status || 500,
    timestamp: new Date().toISOString(),
  });
  // Safe generic error message returned to user
  res.status(err.status || 500).json({ error: 'Internal server error. An unexpected error occurred.' });
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

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [Server] Unhandled Promise Rejection (server protected from crash):', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Server] Uncaught Exception (server protected from crash):', err?.message || err);
});

startServer();
