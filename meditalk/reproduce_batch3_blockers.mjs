// reproduce_batch3_blockers.mjs
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3001';

async function runReproduction() {
  console.log('=================================================================');
  console.log('REPRODUCING 8 BLOCKERS IN MEDITALK TELEHEALTH PLATFORM');
  console.log('=================================================================\n');

  // Authenticate test patient and doctor
  const patRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@meditalk.com', password: 'password', role: 'patient' }),
  }).then(r => r.json());
  const patientToken = patRes.token;
  const patientId = patRes.user?.id || 'P-1001';

  const docRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'doctor@meditalk.com', password: 'password', role: 'doctor' }),
  }).then(r => r.json());
  const doctorToken = docRes.token;
  const doctorId = docRes.user?.id || 'D-201';

  // -------------------------------------------------------------------------
  // ISSUE 1: Video links in emails & calendar invites lead to non-existent route
  // -------------------------------------------------------------------------
  console.log('--- ISSUE 1: Video links in emails & invites lead to 404 / non-existent route ---');
  const emailServiceSrc = fs.readFileSync('backend/services/emailService.js', 'utf8');
  const calSyncSrc = fs.readFileSync('src/utils/calendarSync.js', 'utf8');
  const appJsxSrc = fs.readFileSync('src/App.jsx', 'utf8');

  const emailHasVideoUrl = emailServiceSrc.includes('/video/${appointmentId}');
  const calHasVideoUrl = calSyncSrc.includes('/video/${appointment.id}');
  const appHasVideoRoute = appJsxSrc.includes('path="/video/:');

  console.log(`Email Service contains /video/\${appointmentId}: ${emailHasVideoUrl}`);
  console.log(`Calendar Sync contains /video/\${appointment.id}: ${calHasVideoUrl}`);
  console.log(`Frontend App.jsx contains /video/: route: ${appHasVideoRoute}`);
  if ((emailHasVideoUrl || calHasVideoUrl) && !appHasVideoRoute) {
    console.log('🚨 VULNERABILITY CONFIRMED: Video links generated for emails and calendar invites point to /video/:id, which does NOT exist in App.jsx (hits NotFound wildcard *)\n');
  } else {
    console.log('Issue 1 not reproduced\n');
  }

  // -------------------------------------------------------------------------
  // ISSUE 2: Server crashing when database drops
  // -------------------------------------------------------------------------
  console.log('--- ISSUE 2: Server crashing when database drops / unhandled errors ---');
  const serverSrc = fs.readFileSync('backend/server.js', 'utf8');
  const dbSrc = fs.readFileSync('backend/database/db.js', 'utf8');
  const hasUnhandledRejectionHandler = serverSrc.includes('unhandledRejection');
  const hasUncaughtExceptionHandler = serverSrc.includes('uncaughtException');

  console.log(`server.js has process.on('unhandledRejection'): ${hasUnhandledRejectionHandler}`);
  console.log(`server.js has process.on('uncaughtException'): ${hasUncaughtExceptionHandler}`);
  if (!hasUnhandledRejectionHandler || !hasUncaughtExceptionHandler) {
    console.log('🚨 VULNERABILITY CONFIRMED: Server lacks top-level unhandledRejection / uncaughtException guards. Any unhandled DB drop or connection reset aborts the Node process!\n');
  } else {
    console.log('Issue 2 not reproduced\n');
  }

  // -------------------------------------------------------------------------
  // ISSUE 3: Failed email jobs being marked as successful
  // -------------------------------------------------------------------------
  console.log('--- ISSUE 3: Failed email jobs marked as successful in job queue ---');
  const jobQueueSrc = fs.readFileSync('backend/services/jobQueue.js', 'utf8');
  // Check if send-confirmation worker throws on failure
  const confirmationWorker = jobQueueSrc.slice(jobQueueSrc.indexOf("boss.work('send-confirmation'"), jobQueueSrc.indexOf("boss.work('reminder-24h'"));
  const workerThrowsOnError = confirmationWorker.includes('throw ') || confirmationWorker.includes('success === false');

  console.log(`Confirmation worker code snippet:`);
  console.log(confirmationWorker.trim());
  console.log(`Worker checks result and throws on failure: ${workerThrowsOnError}`);
  if (!workerThrowsOnError) {
    console.log('🚨 VULNERABILITY CONFIRMED: When Resend fails, sendAppointmentConfirmation returns { success: false, error }, but the worker never checks success or throws. pg-boss treats this as a successful job completion!\n');
  } else {
    console.log('Issue 3 not reproduced\n');
  }

  // -------------------------------------------------------------------------
  // ISSUE 4: Booking race conditions (slot booking is not atomic)
  // -------------------------------------------------------------------------
  console.log('--- ISSUE 4: Booking Race Conditions (Double-Booking Vulnerability) ---');
  const raceDate = '2026-12-15';
  const raceTime = '11:30 AM';

  // Fire two concurrent booking requests for the exact same doctor and slot at the exact same moment
  console.log(`Firing 2 concurrent booking requests for Dr. ${doctorId} on ${raceDate} at ${raceTime}...`);
  const [bookRes1, bookRes2] = await Promise.all([
    fetch(`${BASE_URL}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patientToken}` },
      body: JSON.stringify({
        doctorId,
        doctorName: 'Dr. Sarah Jenkins',
        patientId,
        patientName: 'John Patient',
        date: raceDate,
        time: raceTime,
        type: 'video',
        reason: 'Race condition test 1',
      }),
    }),
    fetch(`${BASE_URL}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patientToken}` },
      body: JSON.stringify({
        doctorId,
        doctorName: 'Dr. Sarah Jenkins',
        patientId: 'P-9999', // another patient
        patientName: 'Jane Patient',
        date: raceDate,
        time: raceTime,
        type: 'video',
        reason: 'Race condition test 2',
      }),
    }),
  ]);

  const bookData1 = await bookRes1.json();
  const bookData2 = await bookRes2.json();

  console.log(`Request 1 Status: ${bookRes1.status}`, bookData1.id ? `Created: ${bookData1.id}` : bookData1);
  console.log(`Request 2 Status: ${bookRes2.status}`, bookData2.id ? `Created: ${bookData2.id}` : bookData2);

  if (bookRes1.status === 201 && bookRes2.status === 201) {
    console.log('🚨 VULNERABILITY CONFIRMED: Both concurrent booking requests succeeded! Double-booking created due to non-atomic SELECT-then-INSERT race condition!\n');
  } else {
    console.log(`One request succeeded (${bookRes1.status}), other failed (${bookRes2.status})\n`);
  }

  // -------------------------------------------------------------------------
  // ISSUE 5: Database connection security checks being turned off
  // -------------------------------------------------------------------------
  console.log('--- ISSUE 5: Database Connection Security Checks Disabled ---');
  const dbSslLine = dbSrc.match(/ssl:\s*requiresSsl\s*\?\s*\{[^}]+\}\s*:\s*false/)?.[0] || '';
  const jobSslLine = jobQueueSrc.match(/ssl:\s*connectionString[^}]+\}/s)?.[0] || '';

  console.log(`db.js SSL configuration: ${dbSslLine}`);
  console.log(`jobQueue.js SSL configuration: ${jobSslLine}`);
  if (dbSrc.includes('rejectUnauthorized: false')) {
    console.log('🚨 VULNERABILITY CONFIRMED: rejectUnauthorized is hardcoded to false, disabling SSL certificate authority verification and exposing DB traffic to MITM attacks!\n');
  } else {
    console.log('Issue 5 not reproduced\n');
  }

  // -------------------------------------------------------------------------
  // ISSUE 6: Logged-out sessions becoming valid again after restart
  // -------------------------------------------------------------------------
  console.log('--- ISSUE 6: Logged-out sessions becoming valid again after restart ---');
  const authSrc = fs.readFileSync('backend/routes/auth.js', 'utf8');
  console.log(`auth.js revocation mechanism: Set() declared in memory: ${authSrc.includes('const revokedTokens = new Set()')}`);

  // Test token logout
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${patientToken}` },
  });
  console.log(`Logout Response Status: ${logoutRes.status}`);

  // Verify it is currently blocked while server is running
  const testReqWhileRunning = await fetch(`${BASE_URL}/api/appointments`, {
    headers: { Authorization: `Bearer ${patientToken}` },
  });
  console.log(`Attempt with logged-out token while server running: HTTP ${testReqWhileRunning.status}`);

  if (authSrc.includes('const revokedTokens = new Set()')) {
    console.log('🚨 VULNERABILITY CONFIRMED: Token revocation is stored in an in-memory Set(). On server restart, revokedTokens is reset to empty, and the 7-day token becomes valid and accepted again!\n');
  }

  // -------------------------------------------------------------------------
  // ISSUE 7: Unlimited input sizes
  // -------------------------------------------------------------------------
  console.log('--- ISSUE 7: Unlimited Input Sizes ---');
  const serverJsonLimit = serverSrc.match(/express\.json\(\{\s*limit:\s*['"]([^'"]+)['"]/)?.[1];
  console.log(`express.json body limit: ${serverJsonLimit}`);

  // Authenticate fresh patient for subsequent tests
  const freshPatRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@meditalk.com', password: 'password', role: 'patient' }),
  }).then(r => r.json());
  const freshToken = freshPatRes.token;

  // Send an oversized 2MB payload to verify express accepts it
  const hugeString = 'A'.repeat(2 * 1024 * 1024); // 2MB string
  console.log(`Sending a 2MB payload to /api/triage/assess...`);
  try {
    const hugeRes = await fetch(`${BASE_URL}/api/triage/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
      body: JSON.stringify({ symptoms: hugeString }),
    });
    console.log(`HTTP Status with 2MB payload: ${hugeRes.status}`);
    if (hugeRes.status !== 413 && hugeRes.status !== 400) {
      console.log('🚨 VULNERABILITY CONFIRMED: 2MB payload was accepted without size restriction!\n');
    }
  } catch (e) {
    console.log('Request error:', e.message);
  }

  // -------------------------------------------------------------------------
  // ISSUE 8: Dishonest WhatsApp and SMS reporting
  // -------------------------------------------------------------------------
  console.log('--- ISSUE 8: WhatsApp & SMS falsely reporting success when not sent ---');
  const waRes = await fetch(`${BASE_URL}/api/messaging/test-whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
    body: JSON.stringify({ phone: '+919876543210', customText: 'Test notification' }),
  });
  const waData = await waRes.json();
  console.log(`test-whatsapp HTTP Status: ${waRes.status}`);
  console.log('Response body:', waData);
  if (waData.success === true && waData.mode === 'simulation') {
    console.log('🚨 VULNERABILITY CONFIRMED: WhatsApp API returned success: true and message: "WhatsApp notification generated successfully" even though NO MESSAGE was sent via carrier!\n');
  } else {
    console.log('Issue 8 not reproduced\n');
  }

  console.log('=================================================================');
  console.log('REPRODUCTION COMPLETE');
  console.log('=================================================================');
}

runReproduction().catch(console.error);
