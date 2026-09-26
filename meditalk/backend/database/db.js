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
      connectionTimeoutMillis: 20000,
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
  let schemaSql = fs.readFileSync(schemaPath, 'utf8');
  if (schemaSql.charCodeAt(0) === 0xFEFF) {
    schemaSql = schemaSql.slice(1);
  }
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
    // Phase 8: AI triage summary and urgency level
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS triage_summary TEXT`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'routine'`,
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
    // Phase 9: AI Clinical Records Ingestion — add AI synthesis columns to medical_records
    `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS ai_summary TEXT`,
    `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS extracted_diagnoses TEXT DEFAULT '[]'`,
    `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS extracted_allergies TEXT DEFAULT '[]'`,
    `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS extracted_medications TEXT DEFAULT '[]'`,
    `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS extracted_biomarkers TEXT DEFAULT '[]'`,
    `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS clinical_risks TEXT DEFAULT '[]'`,
    `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS is_external_clinic BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS external_facility_name TEXT`,
    `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ`,
    // Phase 9: E-Pharmacy fulfillment orders
    `CREATE TABLE IF NOT EXISTS pharmacy_orders (
      id TEXT PRIMARY KEY,
      prescription_id TEXT REFERENCES prescriptions(id) ON DELETE CASCADE,
      patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
      patient_name TEXT NOT NULL,
      pharmacy_name TEXT NOT NULL,
      delivery_address TEXT,
      contact_phone TEXT NOT NULL,
      medications TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      tracking_number TEXT,
      estimated_delivery TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_patient ON pharmacy_orders(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_prescription ON pharmacy_orders(prescription_id)`,
    // Phase 9: Patient medication adherence schedule
    `CREATE TABLE IF NOT EXISTS medication_schedules (
      id TEXT PRIMARY KEY,
      patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
      prescription_id TEXT REFERENCES prescriptions(id) ON DELETE SET NULL,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      timing_slots TEXT NOT NULL DEFAULT '["morning"]',
      start_date TIMESTAMPTZ DEFAULT NOW(),
      end_date TIMESTAMPTZ,
      instructions TEXT,
      taken_logs TEXT DEFAULT '{}',
      streak_count INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_med_schedules_patient ON medication_schedules(patient_id)`,
    // Password Reset Tokens (H-5 fix: proper forgot-password flow)
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id        SERIAL PRIMARY KEY,
      user_id   TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      token     TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token)`,
    // CW-7: No-show tracking — new columns on appointments
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by TEXT`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS no_show_reason TEXT`,
    // Track check-in status for CW-6 (waiting room queue)
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_status TEXT DEFAULT NULL`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT NULL`,
    // CW-2: Doctor availability exceptions (leave/vacation)
    `CREATE TABLE IF NOT EXISTS doctor_unavailability (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(doctor_id, date)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_doc_unavail_doctor ON doctor_unavailability(doctor_id)`,
    // CW-3: Follow-up appointment auto-suggestions
    `CREATE TABLE IF NOT EXISTS follow_up_suggestions (
      id TEXT PRIMARY KEY,
      consultation_id TEXT REFERENCES consultations(id) ON DELETE CASCADE,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      doctor_name TEXT,
      suggested_date TEXT NOT NULL,
      reason TEXT,
      instructions TEXT,
      status TEXT DEFAULT 'pending',
      booked_appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_follow_up_patient ON follow_up_suggestions(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_follow_up_doctor ON follow_up_suggestions(doctor_id)`,
    // CW-4: Prescription refill requests
    `CREATE TABLE IF NOT EXISTS refill_requests (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      patient_name TEXT NOT NULL,
      doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      doctor_name TEXT NOT NULL,
      medications TEXT NOT NULL DEFAULT '[]',
      patient_notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      doctor_notes TEXT,
      new_prescription_id TEXT REFERENCES prescriptions(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_refill_requests_patient ON refill_requests(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_refill_requests_doctor ON refill_requests(doctor_id)`,
  ];
  for (const sql of migrations) {
    try { await p.query(sql); } catch (e) { console.warn('[DB] Migration skipped:', e.message); }
  }
  // ────────────────────────────────────────────────────────────────────────

  console.log('📋 Database schema initialized');
}
