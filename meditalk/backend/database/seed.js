/**
 * MediTalk PostgreSQL Seed Script
 * Run with: npm run seed
 */
import 'dotenv/config';
import { getPool, initDb } from './db.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding MediTalk PostgreSQL database...');
  await initDb();
  const pool = getPool();

  try {
    // Clear existing data
    await pool.query('DELETE FROM audit_logs');
    await pool.query('DELETE FROM notifications');
    await pool.query('DELETE FROM prescriptions');
    await pool.query('DELETE FROM consultations');
    await pool.query('DELETE FROM medical_records');
    await pool.query('DELETE FROM appointments');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM doctors');
    await pool.query('DELETE FROM patients');

    // Patients
    const patients = [
      { id: 'P-1001', name: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '+91 98765 43210', dob: '1992-04-12', gender: 'Male', address: '12 Rosewood Lane, Bengaluru', blood_group: 'O+', height: '175 cm', weight: '72 kg', allergies: JSON.stringify(['Penicillin', 'Dust']), chronic_conditions: JSON.stringify(['Mild Asthma']), current_medications: JSON.stringify(['Salbutamol Inhaler']), emergency_contact: JSON.stringify({ name: 'Meera Sharma', relationship: 'Spouse', phone: '+91 98765 43211' }), insurance: JSON.stringify({ provider: 'CareHealth Insurance', policyNumber: 'CH-55892341', validity: '2026-12-31' }), status: 'active' },
      { id: 'P-1002', name: 'Priya Nair', email: 'priya.nair@example.com', phone: '+91 98200 12345', dob: '1988-09-23', gender: 'Female', address: '44 Lake View Road, Kochi', blood_group: 'B+', height: '162 cm', weight: '58 kg', allergies: JSON.stringify(['Peanuts']), chronic_conditions: JSON.stringify([]), current_medications: JSON.stringify(['Vitamin D3']), emergency_contact: JSON.stringify({ name: 'Rahul Nair', relationship: 'Brother', phone: '+91 98200 12346' }), insurance: JSON.stringify({ provider: 'MediShield Plus', policyNumber: 'MS-77812390', validity: '2026-08-30' }), status: 'active' },
    ];

    for (const p of patients) {
      await pool.query(
        'INSERT INTO patients (id, name, email, phone, dob, gender, address, blood_group, height, weight, allergies, chronic_conditions, current_medications, emergency_contact, insurance, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
        [p.id, p.name, p.email, p.phone, p.dob, p.gender, p.address, p.blood_group, p.height, p.weight, p.allergies, p.chronic_conditions, p.current_medications, p.emergency_contact, p.insurance, p.status]
      );
    }

    // Doctors
    const doctors = [
      { id: 'D-201', name: 'Dr. Sneha Menon', email: 'sneha.menon@meditalk.com', phone: '+91 97000 11223', specialty: 'General Medicine', experience: 12, availability: 'Available', status: 'active', bio: 'Experienced physician focused on preventive care.' },
      { id: 'D-202', name: 'Dr. Arjun Patel', email: 'arjun.patel@meditalk.com', phone: '+91 97000 11224', specialty: 'Cardiology', experience: 15, availability: 'Busy', status: 'active', bio: 'Interventional cardiologist.' },
    ];

    for (const d of doctors) {
      await pool.query(
        'INSERT INTO doctors (id, name, email, phone, specialty, experience, availability, status, bio) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [d.id, d.name, d.email, d.phone, d.specialty, d.experience, d.availability, d.status, d.bio]
      );
    }

    // Users
    const hash = bcrypt.hashSync('password', 10);
    const users = [
      { id: 'U-P-1001', name: 'Aarav Sharma', email: 'patient@meditalk.com', password: hash, role: 'patient', patient_id: 'P-1001', doctor_id: null },
      { id: 'U-D-201', name: 'Dr. Sneha Menon', email: 'doctor@meditalk.com', password: hash, role: 'doctor', patient_id: null, doctor_id: 'D-201' },
      { id: 'U-D-202-ARJUN', name: 'Dr. Arjun Patel', email: 'arjun.patel@meditalk.com', password: hash, role: 'doctor', patient_id: null, doctor_id: 'D-202' },
      { id: 'U-ADM-1', name: 'Admin User', email: 'admin@meditalk.com', password: hash, role: 'admin', patient_id: null, doctor_id: null },
      { id: 'U-P-1002', name: 'Aarav Sharma', email: 'patient@meditrack.com', password: hash, role: 'patient', patient_id: 'P-1001', doctor_id: null },
      { id: 'U-D-202', name: 'Dr. Sneha Menon', email: 'doctor@meditrack.com', password: hash, role: 'doctor', patient_id: null, doctor_id: 'D-201' },
      { id: 'U-ADM-2', name: 'Admin User', email: 'admin@meditrack.com', password: hash, role: 'admin', patient_id: null, doctor_id: null },
    ];

    for (const u of users) {
      await pool.query(
        'INSERT INTO users (id, name, email, password, role, patient_id, doctor_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [u.id, u.name, u.email, u.password, u.role, u.patient_id, u.doctor_id]
      );
    }

    // Appointments
    await pool.query(
      'INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, specialty, date, time, type, status, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      ['A-5001', 'P-1001', 'Aarav Sharma', 'D-201', 'Dr. Sneha Menon', 'General Medicine', '2026-09-30', '09:30 AM', 'In-person', 'upcoming', 'Routine health check-up']
    );

    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('Test accounts:');
    console.log('  Admin:       admin@meditalk.com / password');
    console.log('  Patient:     patient@meditalk.com / password');
    console.log('  Doctor (GM): doctor@meditalk.com / password (Dr. Sneha Menon)');
    console.log('  Doctor (CA): arjun.patel@meditalk.com / password (Dr. Arjun Patel)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed database:', err);
    process.exit(1);
  }
}

seed();
