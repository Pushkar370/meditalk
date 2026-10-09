import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { pushNotification } from '../services/sseService.js';
import { enqueueEmail } from '../services/jobQueue.js';
import { JWT_SECRET } from '../config/authConfig.js';
import { logAudit, getClientIp } from '../services/auditService.js';

const router = Router();

// ── Password Strength Rule ──────────────────────────────────────────────────
export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one digit.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character (!@#$%^&* etc).' };
  }
  return { valid: true };
}

// ── Token Revocation Blocklist & Session Versioning ─────────────────────────
// Survives server restarts because revocation state and token_version are persisted in PostgreSQL.
const revokedTokens = new Set();

export async function isTokenRevoked(jti, userId, tokenVersion) {
  if (jti && revokedTokens.has(jti)) return true;
  try {
    if (jti) {
      const { rows } = await query(
        'SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > NOW()',
        [jti]
      );
      if (rows && rows.length > 0) {
        revokedTokens.add(jti);
        return true;
      }
    }
    if (userId) {
      const { rows: uRows } = await query(
        'SELECT token_version FROM users WHERE id = $1',
        [userId]
      );
      if (uRows.length === 0) return true; // Account deleted / not found
      const currentVersion = uRows[0].token_version || 1;
      const userTokenVersion = tokenVersion != null ? Number(tokenVersion) : 1;
      if (currentVersion > userTokenVersion) {
        return true; // Token belongs to an older session superseded by logout/password change/reset
      }
    }
  } catch (err) {
    console.error('[Auth] Error checking token revocation against database:', err.message);
    // Healthcare security principle: fail closed to prevent unauthorized access on database glitch
    return true;
  }
  return false;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Email, password and role are required.' });
  }

  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, role]);
    const user = rows[0];

    if (!user) {
      const { rows: pRows } = await query('SELECT status, consent_withdrawn FROM patients WHERE email = $1', [email]);
      if (pRows[0] && (pRows[0].status === 'withdrawn_consent' || pRows[0].consent_withdrawn === true)) {
        return res.status(403).json({ success: false, message: 'This account was closed and medical consent was withdrawn.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid email, password or role.' });
    }

    // Account-level lockout check (5 failed attempts locks account for 15 minutes)
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      const remainingMin = Math.max(1, Math.ceil((new Date(user.lockout_until).getTime() - Date.now()) / 60000));
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again after ${remainingMin} minute(s).`,
      });
    }

    // Block patient login if consent was withdrawn or account deleted
    if (role === 'patient') {
      const { rows: pRows } = await query(
        'SELECT status, consent_withdrawn FROM patients WHERE id = $1 OR email = $2',
        [user.patient_id || '', email]
      );
      if (pRows[0] && (pRows[0].status === 'withdrawn_consent' || pRows[0].consent_withdrawn === true)) {
        return res.status(403).json({ success: false, message: 'This account was closed and medical consent was withdrawn.' });
      }
    }

    // Block doctor login if not yet verified
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

    // Non-blocking password check
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      let lockoutDate = null;
      if (failedAttempts >= 5) {
        lockoutDate = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lockout
      }
      await query(
        'UPDATE users SET failed_login_attempts = $1, lockout_until = $2 WHERE id = $3',
        [failedAttempts, lockoutDate, user.id]
      );

      if (failedAttempts >= 5) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked for 15 minutes due to 5 consecutive failed login attempts.',
        });
      }

      const remaining = 5 - failedAttempts;
      return res.status(401).json({
        success: false,
        message: `Invalid email, password or role. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before account lockout)`,
      });
    }

    // Reset failed login counter and lockout on successful authentication
    if (user.failed_login_attempts > 0 || user.lockout_until) {
      await query(
        'UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = $1',
        [user.id]
      );
    }

    const jti = crypto.randomUUID(); // unique token ID
    const currentTokenVersion = user.token_version || 1;
    const payload = {
      jti,
      id: user.patient_id || user.doctor_id || user.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tokenVersion: currentTokenVersion,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Add audit log for login
    logAudit({
      userId: user.id,
      userName: user.name,
      role: user.role === 'admin' ? 'Administrator' : user.role.charAt(0).toUpperCase() + user.role.slice(1),
      action: 'Logged in',
      entityType: 'Auth',
      entityId: 'Web Browser',
      status: 'success',
      ipAddress: getClientIp(req),
      userAgent: req.headers?.['user-agent'],
    });

    res.json({
      success: true,
      token,
      user: payload,
      redirectTo: `/${role}/dashboard`,
    });
  } catch (err) {
    console.error('🔒 [Auth Error - Private Log]:', err);
    res.status(500).json({ success: false, message: 'Internal server error. An unexpected error occurred.' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const {
    name, email, password, role = 'patient',
    specialty = 'General Medicine', phone, experience = 1, bio,
    consent, consentAccepted
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
  }

  // Mandatory consent verification
  const hasConsent = consent === true || consent === 'true' || consentAccepted === true || consentAccepted === 'true';
  if (!hasConsent) {
    return res.status(400).json({
      success: false,
      message: 'You must review and accept the Privacy Notice, Terms of Service, and provide medical consent to register.'
    });
  }

  // Mandatory password strength validation
  const strengthCheck = validatePasswordStrength(password);
  if (!strengthCheck.valid) {
    return res.status(400).json({ success: false, message: strengthCheck.error });
  }

  try {
    const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const userId = `U-${Date.now()}`;
    // Non-blocking password hash
    const hash = await bcrypt.hash(password, 10);

    if (role === 'doctor') {
      const doctorId = `D-${Date.now()}`;
      await query(
        `INSERT INTO doctors (id, name, specialty, email, phone, experience, availability, status, bio, verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'Available', 'active', $7, 'pending')`,
        [doctorId, name, specialty, email, phone || null, parseInt(experience, 10) || 1, bio || `${specialty} Specialist`]
      );
      await query(
        `INSERT INTO users (id, name, email, password, role, doctor_id, token_version) VALUES ($1, $2, $3, $4, 'doctor', $5, 1)`,
        [userId, name, email, hash, doctorId]
      );
    } else if (role === 'nurse') {
      await query(
        `INSERT INTO users (id, name, email, password, role, token_version) VALUES ($1, $2, $3, $4, 'nurse', 1)`,
        [userId, name, email, hash]
      );
    } else if (role === 'receptionist') {
      await query(
        `INSERT INTO users (id, name, email, password, role, token_version) VALUES ($1, $2, $3, $4, 'receptionist', 1)`,
        [userId, name, email, hash]
      );
    } else {
      const patientId = `P-${Math.floor(1000 + Math.random() * 9000)}`;
      await query(
        `INSERT INTO patients (id, name, email, phone, status, consent_accepted, consent_accepted_at, consent_version, registered_at)
         VALUES ($1, $2, $3, $4, 'active', TRUE, NOW(), 'v1.0', NOW())`,
        [patientId, name, email, phone || null]
      );
      await query(
        `INSERT INTO users (id, name, email, password, role, patient_id, token_version) VALUES ($1, $2, $3, $4, 'patient', $5, 1)`,
        [userId, name, email, hash, patientId]
      );
    }

    res.status(201).json({ success: true, message: 'Registration successful. Please log in.' });
  } catch (err) {
    console.error('🔒 [Register Error - Private Log]:', err);
    res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

// POST /api/auth/logout — invalidates all sessions for this user across restarts and registers jti in blocklist
router.post('/logout', requireAuth, async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const jti = req.user?.jti;

  try {
    if (userId) {
      // Invalidate all tokens for this user by bumping token_version in PostgreSQL
      await query('UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = $1', [userId]);
    }
    if (jti) {
      revokedTokens.add(jti);
      const expiresAt = req.user.exp
        ? new Date(req.user.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await query(
        'INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING',
        [jti, expiresAt]
      );
    }
  } catch (err) {
    console.warn('[Auth] Error persisting revocation during logout:', err.message);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// PUT /api/auth/password — requires strong password and invalidates all existing sessions across restarts
router.put('/password', requireAuth, async (req, res) => {
  const { currentPassword, nextPassword } = req.body;
  if (!currentPassword || !nextPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  const strengthCheck = validatePasswordStrength(nextPassword);
  if (!strengthCheck.valid) {
    return res.status(400).json({ error: strengthCheck.error });
  }

  try {
    const userId = req.user.userId || req.user.id;
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    // Non-blocking password check
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      return res.status(401).json({ error: 'Incorrect current password.' });
    }

    // Non-blocking password hash
    const newHash = await bcrypt.hash(nextPassword, 10);
    // Invalidate ALL existing sessions across restarts by bumping token_version
    await query(
      'UPDATE users SET password = $1, token_version = COALESCE(token_version, 1) + 1 WHERE id = $2',
      [newHash, userId]
    );

    // Also blocklist current token JTI immediately
    if (req.user.jti) {
      revokedTokens.add(req.user.jti);
      const expiresAt = req.user.exp ? new Date(req.user.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await query('INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING', [req.user.jti, expiresAt]).catch(() => {});
    }

    // Audit log
    logAudit({
      userId: user.id,
      userName: user.name,
      role: user.role === 'admin' ? 'Administrator' : user.role.charAt(0).toUpperCase() + user.role.slice(1),
      action: 'Changed account password',
      entityType: 'Auth',
      entityId: user.id,
      status: 'success',
      ipAddress: getClientIp(req),
      userAgent: req.headers?.['user-agent'],
    });

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

    res.json({ success: true, message: 'Password updated successfully. All existing sessions have been terminated. Please log in again.' });
  } catch (err) {
    console.error('🔒 [Password Update Error - Private Log]:', err);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// GET /api/auth/profile — returns current user account & preferences
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { rows } = await query('SELECT id, name, email, role, phone, preferences, patient_id, doctor_id, created_at FROM users WHERE id = $1', [userId]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    let prefs = {};
    if (typeof user.preferences === 'string') {
      try { prefs = JSON.parse(user.preferences || '{}'); } catch (_) { prefs = {}; }
    } else if (typeof user.preferences === 'object') {
      prefs = user.preferences || {};
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        patientId: user.patient_id,
        doctorId: user.doctor_id,
        createdAt: user.created_at,
        preferences: prefs,
      }
    });
  } catch (err) {
    console.error('🔒 [Profile Error - Private Log]:', err);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// PUT /api/auth/profile — updates account info (name, email, phone)
router.put('/profile', requireAuth, async (req, res) => {
  const { name, email, phone } = req.body;
  const userId = req.user.userId || req.user.id;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  try {
    const { rows: existing } = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'This email is already in use by another account.' });
    }

    const { rows } = await query(
      'UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = $4 RETURNING id, name, email, role, phone, patient_id, doctor_id',
      [name.trim(), email.trim(), phone ? phone.trim() : null, userId]
    );
    const updated = rows[0];

    // Also sync to patients or doctors table if linked
    if (updated?.patient_id) {
      await query('UPDATE patients SET name = $1, email = $2, phone = COALESCE($3, phone) WHERE id = $4', [updated.name, updated.email, updated.phone, updated.patient_id]);
    }
    if (updated?.doctor_id) {
      await query('UPDATE doctors SET name = $1, email = $2, phone = COALESCE($3, phone) WHERE id = $4', [updated.name, updated.email, updated.phone, updated.doctor_id]);
    }

    res.json({ success: true, message: 'Profile updated successfully.', user: updated });
  } catch (err) {
    console.error('🔒 [Profile Update Error - Private Log]:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// PUT /api/auth/preferences — updates user notification & appointment preferences
router.put('/preferences', requireAuth, async (req, res) => {
  const { preferences } = req.body;
  const userId = req.user.userId || req.user.id;

  try {
    const prefsJson = JSON.stringify(preferences || {});
    await query('UPDATE users SET preferences = $1 WHERE id = $2', [prefsJson, userId]);
    res.json({ success: true, message: 'Preferences saved successfully.', preferences });
  } catch (err) {
    console.error('🔒 [Preferences Error - Private Log]:', err);
    res.status(500).json({ error: 'Failed to save preferences.' });
  }
});

// ── Password Reset Flow ──────────────────────────────────────────────────────

// POST /api/auth/forgot-password
// Generates a secure, time-limited reset token and sends ONLY via email (never exposed in response or console)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const { rows } = await query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    // Always return safe generic success to prevent email enumeration
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

    // Send password reset email via job queue (strictly via email)
    try {
      await enqueueEmail('send-password-reset', {
        email: user.email,
        name: user.name,
        resetToken,
      });
    } catch (emailErr) {
      console.warn('[Auth] Failed to queue reset email (non-fatal):', emailErr.message);
    }

    // Audit log
    logAudit({
      userId: user.id,
      userName: user.name,
      role: 'User',
      action: 'Requested password reset',
      entityType: 'Auth',
      entityId: user.id,
      status: 'success',
      ipAddress: getClientIp(req),
      userAgent: req.headers?.['user-agent'],
    });

    // Strictly send response WITHOUT token in any environment
    res.json({
      success: true,
      message: 'If that email exists, a reset link was sent.',
    });
  } catch (err) {
    console.error('🔒 [Forgot-Password Error - Private Log]:', err);
    res.status(500).json({ error: 'Password reset request failed.' });
  }
});

// POST /api/auth/reset-password
// Validates reset token, validates strength, sets new password and invalidates all existing sessions
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and newPassword are required.' });
  }

  const strengthCheck = validatePasswordStrength(newPassword);
  if (!strengthCheck.valid) {
    return res.status(400).json({ error: strengthCheck.error });
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

    // Non-blocking password hash
    const newHash = await bcrypt.hash(newPassword, 10);
    // Invalidate ALL previous sessions across restarts by incrementing token_version
    await query(
      'UPDATE users SET password = $1, token_version = COALESCE(token_version, 1) + 1 WHERE id = $2',
      [newHash, user_id]
    );

    // Invalidate the reset token immediately after use
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user_id]);

    // Audit log
    logAudit({
      userId: user_id,
      userName: name,
      role: 'User',
      action: 'Reset password via reset token',
      entityType: 'Auth',
      entityId: user_id,
      status: 'success',
      ipAddress: getClientIp(req),
      userAgent: req.headers?.['user-agent'],
    });

    res.json({ success: true, message: 'Password reset successfully. All existing sessions have been terminated. You can now log in.' });
  } catch (err) {
    console.error('🔒 [Reset-Password Error - Private Log]:', err);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

export default router;
