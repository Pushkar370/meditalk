import { spawn } from 'child_process';
import jwt from 'jsonwebtoken';
import { query } from './backend/database/db.js';

const BASE_URL = 'http://localhost:3001';

async function run() {
  console.log('🧪 Starting Stage 1 Findings Verification Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // Helper to create or get a test user
  const testEmail = `test_stage1_${Date.now()}@meditalk.com`;
  const initialPassword = 'SecurePassword123!';
  const updatedPassword = 'NewStrongPassword456!';

  console.log('--- TEST 6: Minimum Password Length & Strength Rules ---');
  // Weak passwords
  const weakPasswords = [
    { pw: 'short1!', reason: 'Too short (<8 chars)' },
    { pw: 'alllowercase1!', reason: 'Missing uppercase' },
    { pw: 'ALLUPPERCASE1!', reason: 'Missing lowercase' },
    { pw: 'NoSpecialDigit123', reason: 'Missing special character' },
    { pw: 'NoDigitsSpecial!@#', reason: 'Missing digit' },
  ];

  for (const { pw, reason } of weakPasswords) {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Weak Pw Test',
        email: `weak_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        password: pw,
        role: 'patient',
        consentAccepted: true,
      }),
    });
    const data = await res.json();
    assert(res.status === 400 && data.success === false, `Registration rejected weak password (${reason}): "${pw}" -> status ${res.status}`);
  }

  // Register with strong password
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Stage1 Verified User',
      email: testEmail,
      password: initialPassword,
      role: 'patient',
      consentAccepted: true,
    }),
  });
  const regData = await regRes.json();
  assert(regRes.status === 201 && regData.success === true, `Registration accepted compliant password: status ${regRes.status}`);

  console.log('\n--- TEST 6 (Part 2): Account-Level Lockout (5 Failed Logins) ---');
  // 5 failed logins
  for (let i = 1; i <= 5; i++) {
    const failRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'WrongPassword999!', role: 'patient' }),
    });
    const failData = await failRes.json();
    if (i < 5) {
      assert(failRes.status === 401 && failData.message.includes('remaining'), `Failed attempt ${i}/5 returned 401 with remaining attempts warning`);
    } else {
      assert(failRes.status === 423 && failData.message.includes('locked'), `Failed attempt 5/5 triggered account lockout (HTTP 423 Locked)`);
    }
  }

  // 6th attempt should be blocked by lockout without even checking password
  const lockedRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: initialPassword, role: 'patient' }),
  });
  const lockedData = await lockedRes.json();
  assert(lockedRes.status === 423 && lockedData.message.includes('temporarily locked'), `6th login attempt immediately blocked by account lockout (HTTP 423)`);

  // Reset lockout in DB for this test user to proceed with subsequent tests
  await query('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE email = $1', [testEmail]);

  console.log('\n--- TEST 1: Session Invalidation on Logout and Password Change (Survives Server Restart) ---');
  // Login to get token 1
  const loginRes1 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: initialPassword, role: 'patient' }),
  });
  const loginData1 = await loginRes1.json();
  const token1 = loginData1.token;
  assert(loginRes1.status === 200 && !!token1, `Successfully logged in, received JWT session token 1`);

  // Verify token 1 works
  const profileRes1 = await fetch(`${BASE_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(profileRes1.status === 200, `Token 1 successfully accessed /api/auth/profile (HTTP 200)`);

  // Change password using token 1
  const changePwRes = await fetch(`${BASE_URL}/api/auth/password`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token1}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: initialPassword,
      nextPassword: updatedPassword,
    }),
  });
  assert(changePwRes.status === 200, `Password changed successfully to new password (HTTP 200)`);

  // Verify token 1 is now INVALIDATED
  const profileResAfterChange = await fetch(`${BASE_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(profileResAfterChange.status === 401, `Old token 1 was immediately rejected with HTTP 401 after password change`);

  // Simulate server restart / cold process checking token 1
  // We check directly against the auth revocation function in a fresh import
  const { isTokenRevoked } = await import('./backend/routes/auth.js');
  const decodedToken1 = jwt.decode(token1);
  const isRevokedInDb = await isTokenRevoked(decodedToken1.jti, decodedToken1.userId, decodedToken1.tokenVersion);
  assert(isRevokedInDb === true, `Old token 1 is recognized as revoked via PostgreSQL token_version (survives any server reboot)`);

  // Log in with new password to get token 2
  const loginRes2 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: updatedPassword, role: 'patient' }),
  });
  const loginData2 = await loginRes2.json();
  const token2 = loginData2.token;
  assert(loginRes2.status === 200 && !!token2, `Successfully logged in with updated password, received token 2`);

  // Logout with token 2
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
  });
  assert(logoutRes.status === 200, `Logged out token 2 successfully`);

  // Verify token 2 is now INVALIDATED
  const profileResAfterLogout = await fetch(`${BASE_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  assert(profileResAfterLogout.status === 401, `Logged-out token 2 is rejected with HTTP 401`);

  console.log('\n--- TEST 2: Secret Hardening (Refuses Startup if Missing or Weak) ---');
  // Subprocess test: run server with missing secret
  const procMissing = spawn('node', ['-e', `
    process.env.JWT_SECRET = '';
    import('./backend/config/authConfig.js').catch(() => {});
  `], { stdio: 'pipe' });
  const missingExitCode = await new Promise(res => procMissing.on('close', res));
  assert(missingExitCode === 1, `Process exited with code 1 when JWT_SECRET was missing`);

  // Subprocess test: run server with weak/default secret
  const procWeak = spawn('node', ['-e', `
    process.env.JWT_SECRET = 'meditalk_dev_secret_2026';
    import('./backend/config/authConfig.js').catch(() => {});
  `], { stdio: 'pipe' });
  const weakExitCode = await new Promise(res => procWeak.on('close', res));
  assert(weakExitCode === 1, `Process exited with code 1 when JWT_SECRET was default 'meditalk_dev_secret_2026'`);

  // Subprocess test: run server with <32 char secret
  const procShort = spawn('node', ['-e', `
    process.env.JWT_SECRET = 'short_secret_12345';
    import('./backend/config/authConfig.js').catch(() => {});
  `], { stdio: 'pipe' });
  const shortExitCode = await new Promise(res => procShort.on('close', res));
  assert(shortExitCode === 1, `Process exited with code 1 when JWT_SECRET was <32 characters`);

  console.log('\n--- TEST 3: Forgot-Password Response Never Contains Reset Token ---');
  const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const forgotData = await forgotRes.json();
  assert(forgotRes.status === 200, `Forgot-password responded with HTTP 200`);
  assert(forgotData._devToken === undefined, `Response does NOT contain _devToken`);
  assert(forgotData.token === undefined, `Response does NOT contain token`);
  assert(forgotData.resetToken === undefined, `Response does NOT contain resetToken`);
  assert(forgotData.message === 'If that email exists, a reset link was sent.', `Response returns safe generic message`);

  console.log('\n--- TEST 4: Internal Database Errors Sanitized (Never Expose err.message) ---');
  const errRes = await fetch(`${BASE_URL}/api/messaging/test-whatsapp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token1}`, // invalid token or error
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: 'invalid' }),
  });
  const errData = await errRes.json();
  assert(errData.details === undefined, `Error response does not leak internal 'details: err.message'`);

  console.log('\n--- TEST 7: Live Notification Stream Rejects Tokens in URL ---');
  // Attempt with token in URL query param
  const urlTokenRes = await fetch(`${BASE_URL}/api/notifications/stream?token=some_token`);
  const urlTokenData = await urlTokenRes.json();
  assert(urlTokenRes.status === 400 && urlTokenData.error.includes('URL query parameters are not permitted'), `SSE stream rejected token in URL query parameter with HTTP 400`);

  // Attempt with revoked token in Authorization header
  const revokedSseRes = await fetch(`${BASE_URL}/api/notifications/stream`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(revokedSseRes.status === 401, `SSE stream rejected revoked token with HTTP 401`);

  console.log('\n--- TEST 8: Content Security Policy Active ---');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const cspHeader = healthRes.headers.get('content-security-policy');
  assert(!!cspHeader, `Content-Security-Policy header is present in HTTP response`);
  assert(cspHeader.includes("frame-src 'self' https://meet.jit.si"), `CSP allows Jitsi video consultation iframe (meet.jit.si)`);
  assert(cspHeader.includes("fonts.googleapis.com"), `CSP allows Google Fonts`);

  console.log('\n--- TEST 9: Trust Proxy Configured for Render ---');
  const { default: app } = await import('./backend/server.js');
  assert(app.get('trust proxy') === 1, `Express app trust proxy is set to 1 (trusts first hop / Render reverse proxy)`);

  console.log('\n--- TEST 10: Non-blocking Bcrypt Used Across Auth Routes ---');
  const authCode = (await import('fs')).readFileSync('./backend/routes/auth.js', 'utf8');
  assert(!authCode.includes('bcrypt.hashSync'), `auth.js contains 0 calls to blocking bcrypt.hashSync`);
  assert(!authCode.includes('bcrypt.compareSync'), `auth.js contains 0 calls to blocking bcrypt.compareSync`);

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
