import dns from 'dns';
import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Enforce IPv4 priority to prevent IPv6 routing timeouts with Neon AWS endpoints
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

let pool;

export function getPool() {
  if (!pool) {
    let connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required. Please set it in your .env file.\nExample: DATABASE_URL=postgresql://postgres:password@localhost:5432/meditalk');
    }
    // Strip channel_binding if present (Neon includes channel_binding=require which breaks node-postgres)
    connectionString = connectionString.replace(/[?&]channel_binding=[^&]+/g, '');
    const requiresSsl = process.env.NODE_ENV === 'production' ||
      connectionString.includes('sslmode=require') ||
      connectionString.includes('neon.tech') ||
      connectionString.includes('supabase.co') ||
      connectionString.includes('render.com');

    pool = new Pool({
      connectionString,
      ssl: requiresSsl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    pool.on('error', (err) => {
      // Suppress noisy stack traces for expected Neon idle client termination
      const msg = err?.message || '';
      if (msg.includes('Connection terminated') || msg.includes('closed') || err?.code === 'ECONNRESET') {
        console.warn('⚠️ [DB] PostgreSQL idle client recycled.');
      } else {
        console.error('[DB] Unexpected error on idle client:', msg);
      }
    });

    console.log('🐘 Connected to PostgreSQL');
  }
  return pool;
}

// Deep database ping helper for health checks
export async function pingDb() {
  const start = Date.now();
  try {
    const p = getPool();
    await p.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message, latencyMs: Date.now() - start };
  }
}

// Pool allocation statistics
export function getPoolStats() {
  if (!pool) return { totalCount: 0, idleCount: 0, waitingCount: 0 };
  return {
    totalCount: pool.totalCount || 0,
    idleCount: pool.idleCount || 0,
    waitingCount: pool.waitingCount || 0,
  };
}

// Graceful pool drainage
export async function closePool() {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('🛑 PostgreSQL pool drained and closed.');
    } catch (err) {
      console.warn('⚠️ Error while draining PostgreSQL pool:', err.message);
    }
  }
}

// Convenience wrapper — returns full pg QueryResult
export async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

// Run schema SQL on startup (idempotent CREATE TABLE IF NOT EXISTS)
export async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const p = getPool();
  await p.query(schemaSql);

  // ── Column migrations (idempotent — safe to run every startup) ──────────
  const migrations = [
    // Phase 3: video consultation status tracking
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS video_status TEXT DEFAULT NULL`,
    // Phase 2: cancellation reason
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_reason TEXT`,
    // Phase 5: doctor verification workflow
    `ALTER TABLE doctors ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'approved'`,
    `ALTER TABLE doctors ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`,
    `ALTER TABLE doctors ADD COLUMN IF NOT EXISTS rejection_notes TEXT`,
    // notifications timestamp compatibility
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    // doctor_schedules table guard (created in schema but may be missing in old DBs)
    `CREATE TABLE IF NOT EXISTS doctor_schedules (
      id          TEXT PRIMARY KEY,
      doctor_id   TEXT UNIQUE REFERENCES doctors(id) ON DELETE CASCADE,
      work_days   TEXT DEFAULT '[1,2,3,4,5]',
      start_time  TEXT DEFAULT '09:00',
      end_time    TEXT DEFAULT '17:00',
      slot_mins   INTEGER DEFAULT 30,
      break_start TEXT DEFAULT '13:00',
      break_end   TEXT DEFAULT '14:00',
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];
  for (const sql of migrations) {
    try { await p.query(sql); } catch (e) { console.warn('[DB] Migration skipped:', e.message); }
  }
  // ────────────────────────────────────────────────────────────────────────

  console.log('📋 Database schema initialized');
}
