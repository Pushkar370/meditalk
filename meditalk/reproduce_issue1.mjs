import 'dotenv/config';

const BASE = 'http://localhost:3001/api';

async function req(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

async function run() {
  console.log('--- REPRODUCING ISSUE 1: Session invalidation failure ---');
  // 1. Login session A
  const loginA = await req('POST', '/auth/login', {
    body: { email: 'patient@meditalk.com', password: 'password', role: 'patient' }
  });
  const tokenA = loginA.data?.token;

  // 2. Login session B (second device)
  const loginB = await req('POST', '/auth/login', {
    body: { email: 'patient@meditalk.com', password: 'password', role: 'patient' }
  });
  const tokenB = loginB.data?.token;

  console.log('Session A Login:', loginA.status, tokenA ? 'Token A created' : 'Failed');
  console.log('Session B Login:', loginB.status, tokenB ? 'Token B created' : 'Failed');

  // Verify both work
  const checkA = await req('GET', '/auth/profile', { token: tokenA });
  const checkB = await req('GET', '/auth/profile', { token: tokenB });
  console.log('Session A initial profile check:', checkA.status);
  console.log('Session B initial profile check:', checkB.status);

  // 3. Update password on Session A
  const pwUpdate = await req('PUT', '/auth/password', {
    token: tokenA,
    body: { currentPassword: 'password', nextPassword: 'password' }
  });
  console.log('Password updated on Session A:', pwUpdate.status);

  // 4. Test Session B
  const checkBAfter = await req('GET', '/auth/profile', { token: tokenB });
  console.log('Session B profile check after password change: HTTP', checkBAfter.status);

  if (checkBAfter.status === 200) {
    console.log('❌ BUG CONFIRMED: Session B remained valid (HTTP 200) after password change! Existing sessions were NOT invalidated.');
  } else {
    console.log('Session B was blocked with HTTP', checkBAfter.status);
  }
}

run();
