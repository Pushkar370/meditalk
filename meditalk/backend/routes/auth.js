import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { pushNotification } from '../server.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'meditalk_dev_secret_2026';

// ── Token Revocation Blocklist (in-memory; survives until process restart) ───
// For production, this should be moved to Redis or a DB table for persistence
const revokedTokens = new Set();
export function isTokenRevoked(jti) { return revokedTokens.has(jti); }


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

    const jti = crypto.randomUUID(); // unique token ID for revocation
    const payload = {
      jti,
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
      // Use timestamp-based ID to eliminate collision risk (was: 3-digit random → ~50% collision at 30 doctors)
      const doctorId = `D-${Date.now()}`;
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

// POST /api/auth/logout — revokes the current token
router.post('/logout', requireAuth, (req, res) => {
  const jti = req.user.jti;
  if (jti) {
    revokedTokens.add(jti);
    // Auto-purge after 7 days to prevent unbounded memory growth
    setTimeout(() => revokedTokens.delete(jti), 7 * 24 * 60 * 60 * 1000);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// PUT /api/auth/password
router.put('/password', requireAuth, async (req, res) => {
  const { currentPassword, nextPassword } = req.body;
  if (!currentPassword || !nextPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (nextPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const userId = req.user.userId || req.user.id;
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Incorrect current password.' });
    }

    const newHash = bcrypt.hashSync(nextPassword, 10);
    await query('UPDATE users SET password = $1 WHERE id = $2', [newHash, userId]);

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, $3, 'Changed account password', 'Auth', $1, 'success')`,
        [user.id, user.name, user.role === 'admin' ? 'Administrator' : user.role.charAt(0).toUpperCase() + user.role.slice(1)]
      );
    } catch (_) {}

    // In-app notification
    try {
      const notifId = `N-${Date.now()}`;
      await query(
        `INSERT INTO notifications (id, user_id, title, message, type, read, date)
         VALUES ($1, $2, 'Security Alert: Password Changed', 'Your MediTalk password was updated successfully.', 'info', false, NOW())`,
        [notifId, user.id]
      );
      try {
        pushNotification(user.id, {
          id: notifId,
          title: 'Security Alert: Password Changed',
          message: 'Your MediTalk password was updated successfully.',
          type: 'info',
        });
      } catch (_) {}
    } catch (_) {}

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// ── Password Reset Flow (H-5 Fix) ────────────────────────────────────────────

// POST /api/auth/forgot-password
// Generates a secure, time-limited reset token and stores it in the DB.
// In production, this token would be emailed. For now, it is returned in the
// response so the frontend can display/redirect to the reset form.
// Swap the TODO block below with a real email (Nodemailer/Resend/SendGrid) before go-live.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const { rows } = await query('SELECT id, name FROM users WHERE email = $1', [email]);
    // Always return success to prevent email enumeration
    if (!rows[0]) {
      return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
    }
    const user = rows[0];

    // Generate a cryptographically strong 32-byte token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Persist the token (idempotent — upsert by user_id)
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token=$2, expires_at=$3`,
      [user.id, resetToken, expiresAt]
    );

    // TODO: Send email here using your email provider (Resend, SendGrid, Nodemailer)
    // Example: await sendResetEmail(email, `https://yourapp.com/reset-password?token=${resetToken}`);
    // For now, we log it to the console in development only:
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
    }

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, 'User', 'Requested password reset', 'Auth', $1, 'success')`,
        [user.id, user.name]
      );
    } catch (_) {}

    res.json({
      success: true,
      message: 'If that email exists, a reset link was sent.',
      // Only expose the token in non-production so the dev can test the flow
      ...(process.env.NODE_ENV !== 'production' ? { _devToken: resetToken } : {}),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password reset request failed.' });
  }
});

// POST /api/auth/reset-password
// Validates the reset token and sets the new password.
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and newPassword are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const { rows } = await query(
      `SELECT prt.user_id, u.name FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1 AND prt.expires_at > NOW()`,
      [token]
    );
    if (!rows[0]) {
      return res.status(400).json({ error: 'Invalid or expired reset token. Please request a new one.' });
    }
    const { user_id, name } = rows[0];

    const newHash = bcrypt.hashSync(newPassword, 10);
    await query('UPDATE users SET password = $1 WHERE id = $2', [newHash, user_id]);

    // Invalidate the token immediately after use
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user_id]);

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, 'User', 'Reset password via reset token', 'Auth', $1, 'success')`,
        [user_id, name]
      );
    } catch (_) {}

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

export default router;
