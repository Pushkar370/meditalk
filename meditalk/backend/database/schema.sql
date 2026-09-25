-- ============================================================
-- MediTalk Database Schema — Complete & Canonical
-- This file is the single source of truth for the DB structure.
-- ALL tables and columns (including Phase 5-9 additions) are here.
-- Safe to run on an empty DB or re-run (all CREATE TABLE IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
  patient_id TEXT,
  doctor_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  dob TEXT,
  gender TEXT,
  address TEXT,
  blood_group TEXT,
  height TEXT,
  weight TEXT,
  allergies TEXT DEFAULT '[]',
  chronic_conditions TEXT DEFAULT '[]',
  current_medications TEXT DEFAULT '[]',
  emergency_contact TEXT DEFAULT '{}',
  insurance TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  specialty TEXT,
  experience INTEGER DEFAULT 0,
  rating NUMERIC(3,1) DEFAULT 5.0,
  availability TEXT DEFAULT 'Available',
  bio TEXT,
  status TEXT DEFAULT 'active',
  verification_status TEXT DEFAULT 'approved',
  verified_at TIMESTAMPTZ,
  rejection_notes TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_schedules (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT UNIQUE REFERENCES doctors(id) ON DELETE CASCADE,
  work_days   TEXT DEFAULT '[1,2,3,4,5]',
  start_time  TEXT DEFAULT '09:00',
  end_time    TEXT DEFAULT '17:00',
  slot_mins   INTEGER DEFAULT 30,
  break_start TEXT DEFAULT '13:00',
  break_end   TEXT DEFAULT '14:00',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  doctor_id TEXT REFERENCES doctors(id) ON DELETE SET NULL,
  doctor_name TEXT,
  specialty TEXT,
  date TEXT,
  time TEXT,
  type TEXT,
  reason TEXT,
  cancel_reason TEXT,
  video_status TEXT DEFAULT NULL,
  triage_summary TEXT,
  urgency TEXT DEFAULT 'routine',
  status TEXT DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consultations (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  doctor_id TEXT REFERENCES doctors(id) ON DELETE SET NULL,
  reason TEXT,
  symptoms TEXT,
  vitals TEXT DEFAULT '{}',
  diagnosis TEXT,
  diagnosis_code TEXT,
  observations TEXT,
  lab_results TEXT,
  treatment_plan TEXT,
  follow_up_date TEXT,
  follow_up_instructions TEXT,
  status TEXT DEFAULT 'completed',
  date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  doctor_id TEXT REFERENCES doctors(id) ON DELETE SET NULL,
  doctor_name TEXT,
  medications TEXT DEFAULT '[]',
  additional_instructions TEXT,
  status TEXT DEFAULT 'active',
  date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_records (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  type TEXT,
  description TEXT,
  doctor TEXT,
  details TEXT DEFAULT '{}',
  date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'final',
  ai_summary TEXT,
  extracted_diagnoses TEXT DEFAULT '[]',
  extracted_allergies TEXT DEFAULT '[]',
  extracted_medications TEXT DEFAULT '[]',
  extracted_biomarkers TEXT DEFAULT '[]',
  clinical_risks TEXT DEFAULT '[]',
  is_external_clinic BOOLEAN DEFAULT FALSE,
  external_facility_name TEXT,
  ai_processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pharmacy_orders (
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
);

CREATE TABLE IF NOT EXISTS medication_schedules (
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
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  read BOOLEAN DEFAULT FALSE,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  role TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  status TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id        SERIAL PRIMARY KEY,
  user_id   TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token     TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_patient ON pharmacy_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_prescription ON pharmacy_orders(prescription_id);
CREATE INDEX IF NOT EXISTS idx_med_schedules_patient ON medication_schedules(patient_id);
CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
