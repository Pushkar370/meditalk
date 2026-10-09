// scripts/add_atomic_indexes.js
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL.replace(/[?&]channel_binding=[^&]+/g, '');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: true },
});

async function run() {
  try {
    // Check for any duplicate active slots and cancel duplicates if any exist
    const { rows: dups } = await pool.query(
      `SELECT doctor_id, date, time, count(*) FROM appointments WHERE status NOT IN ('cancelled') GROUP BY doctor_id, date, time HAVING count(*) > 1`
    );
    console.log('Active doctor slot duplicates found:', dups);
    for (const d of dups) {
      const { rows } = await pool.query(
        `SELECT id FROM appointments WHERE doctor_id = $1 AND date = $2 AND time = $3 AND status NOT IN ('cancelled') ORDER BY created_at ASC`,
        [d.doctor_id, d.date, d.time]
      );
      // Keep the first, cancel the others
      const toCancel = rows.slice(1);
      for (const r of toCancel) {
        await pool.query(`UPDATE appointments SET status = 'cancelled', cancel_reason = 'Deduplicated' WHERE id = $1`, [r.id]);
        console.log(`Cancelled duplicate appointment ${r.id}`);
      }
    }

    // Now create unique index on (doctor_id, date, time)
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_atomic_doctor_slot ON appointments (doctor_id, date, time) WHERE status NOT IN ('cancelled')`
    );
    console.log('✅ Created unique index idx_atomic_doctor_slot');

    // Create unique index on (patient_id, date, time)
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_atomic_patient_slot ON appointments (patient_id, date, time) WHERE status NOT IN ('cancelled')`
    );
    console.log('✅ Created unique index idx_atomic_patient_slot');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

run();
