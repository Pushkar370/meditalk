import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database/db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'meditalk_dev_secret_2026';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Email, password and role are required.' });
  }

  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, role]);
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Invalid email, password or role.' });
    }

    // Phase 5: block doctor login if not yet verified
    if (role === 'doctor' && user.doctor_id) {
      const { rows: docRows } = await query('SELECT verification_status, rejection_notes FROM doctors WHERE id = $1', [user.doctor_id]);
      const doc = docRows[0];
      if (doc) {
        if (doc.verification_status === 'pending') {
          return res.status(403).json({ success: false, message: 'Your account is pending admin verification. You will be notified once approved.' });
        }
        if (doc.verification_status === 'rejected') {
          return res.status(403).json({ success: false, message: `Your account registration was rejected. Reason: ${doc.rejection_notes || 'Please contact support.'}` });
        }
      }
    }

    const payload = {
      id: user.patient_id || user.doctor_id || user.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Add audit log for login
    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, $3, 'Logged in', 'Auth', 'Web Browser', 'success')`,
        [user.id, user.name, user.role === 'admin' ? 'Administrator' : user.role.charAt(0).toUpperCase() + user.role.slice(1)]
      );
    } catch (_) { /* non-critical */ }

    res.json({
      success: true,
      token,
      user: payload,
      redirectTo: `/${role}/dashboard`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role = 'patient', specialty = 'General Medicine', phone, experience = 1, bio } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
  }

  try {
    const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const userId = `U-${Date.now()}`;
    const hash = bcrypt.hashSync(password, 10);

    if (role === 'doctor') {
      const doctorId = `D-${Math.floor(100 + Math.random() * 900)}`;
      await query(
        `INSERT INTO doctors (id, name, specialty, email, phone, experience, availability, status, bio, verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'Available', 'active', $7, 'pending')`,
        [doctorId, name, specialty, email, phone || null, parseInt(experience, 10) || 1, bio || `${specialty} Specialist`]
      );
      await query(
        `INSERT INTO users (id, name, email, password, role, doctor_id) VALUES ($1, $2, $3, $4, 'doctor', $5)`,
        [userId, name, email, hash, doctorId]
      );
    } else {
      const patientId = `P-${Math.floor(1000 + Math.random() * 9000)}`;
      await query(
        `INSERT INTO patients (id, name, email, phone, status, registered_at) VALUES ($1, $2, $3, $4, 'active', NOW())`,
        [patientId, name, email, phone || null]
      );
      await query(
        `INSERT INTO users (id, name, email, password, role, patient_id) VALUES ($1, $2, $3, $4, 'patient', $5)`,
        [userId, name, email, hash, patientId]
      );
    }

    res.status(201).json({ success: true, message: 'Registration successful. Please log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

export default router;
