import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false'
    ? { rejectUnauthorized: false }
    : { rejectUnauthorized: true },
});

async function migrate() {
  console.log('🔄 Running consent, emergency, and staff role migrations...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update users role check constraint to include nurse and receptionist
    console.log('1. Updating users.role CHECK constraint...');
    // Drop existing check constraint if present
    await client.query(`
      DO $$
      DECLARE
        con_name text;
      BEGIN
        FOR con_name IN (
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'users'::regclass AND contype = 'c'
        ) LOOP
          EXECUTE 'ALTER TABLE users DROP CONSTRAINT IF EXISTS ' || quote_ident(con_name);
        END LOOP;
      END $$;
    `);

    await client.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('patient', 'doctor', 'admin', 'nurse', 'receptionist'))
    `);

    // 2. Add consent columns to patients table
    console.log('2. Adding consent columns to patients table...');
    await client.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT TRUE`);
    await client.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ DEFAULT NOW()`);
    await client.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_version TEXT DEFAULT 'v1.0'`);
    await client.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_withdrawn BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_withdrawn_at TIMESTAMPTZ`);

    // 3. Add telehealth consent & pre-recorded vitals columns to appointments table
    console.log('3. Adding telehealth consent & vitals columns to appointments table...');
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_consent BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_consent_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS vitals TEXT DEFAULT '{}'`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS vitals_recorded_by TEXT`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS vitals_recorded_at TIMESTAMPTZ`);

    // 4. Create dedicated patient_vitals history table if not exists
    console.log('4. Creating patient_vitals table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_vitals (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
        recorded_by_id TEXT,
        recorded_by_name TEXT,
        role TEXT NOT NULL DEFAULT 'nurse',
        bp TEXT,
        systolic INTEGER,
        diastolic INTEGER,
        hr INTEGER,
        temp NUMERIC(4,1),
        spo2 INTEGER,
        weight NUMERIC(5,2),
        blood_sugar NUMERIC(5,1),
        notes TEXT,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient ON patient_vitals(patient_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_patient_vitals_appt ON patient_vitals(appointment_id)`);

    // 5. Seed default Nurse and Receptionist accounts if not existing
    console.log('5. Ensuring default Nurse and Receptionist users exist...');
    const bcrypt = await import('bcryptjs');
    const hash = bcrypt.default.hashSync('password', 10);

    // Nurse
    const { rows: nurseExists } = await client.query("SELECT id FROM users WHERE email = 'nurse@meditalk.com'");
    if (nurseExists.length === 0) {
      await client.query(
        `INSERT INTO users (id, name, email, password, role)
         VALUES ('U-NURSE-01', 'Nurse Clara Barton', 'nurse@meditalk.com', $1, 'nurse')`,
        [hash]
      );
      console.log('   Created default nurse: nurse@meditalk.com');
    }

    // Receptionist
    const { rows: recepExists } = await client.query("SELECT id FROM users WHERE email = 'receptionist@meditalk.com'");
    if (recepExists.length === 0) {
      await client.query(
        `INSERT INTO users (id, name, email, password, role)
         VALUES ('U-RECEP-01', 'Sarah Jenkins (Reception)', 'receptionist@meditalk.com', $1, 'receptionist')`,
        [hash]
      );
      console.log('   Created default receptionist: receptionist@meditalk.com');
    }

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
