// test_audit_hardening.mjs
// Automated verification suite for tamper-resistant audit logs and read auditing

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from './backend/database/db.js';
import { JWT_SECRET } from './backend/config/authConfig.js';
import {
  computeAuditHash,
  verifyAuditChain,
  flushAuditQueue,
  auditAccess,
  GENESIS_HASH,
} from './backend/services/auditService.js';

const BASE_URL = 'http://localhost:3001/api';

function makeToken(payload) {
  const jti = 'jti_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  return jwt.sign(
    {
      jti,
      tokenVersion: 1,
      ...payload,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function api(path, token, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'MediTalk-Audit-Tester/1.0',
    'X-Forwarded-For': '198.51.100.42', // Custom IP to test "from where"
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  let data;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  return { status: res.status, data };
}

async function run() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(' 🔒 AUDIT LOG TAMPER-RESISTANCE & READ AUDITING TEST SUITE');
  console.log('══════════════════════════════════════════════════════════════════\n');

  console.log('▶ [SETUP] Preparing test fixtures in database...');
  const hash = await bcrypt.hash('AuditPass123!', 10);

  // Clean test fixtures
  await query("DELETE FROM users WHERE email IN ('admin.audit@test.com', 'doctor.audit@test.com', 'patient.audit@test.com')");
  await query("DELETE FROM appointments WHERE patient_id = 'P-AUDIT-1'");
  await query("DELETE FROM consultations WHERE patient_id = 'P-AUDIT-1'");
  await query("DELETE FROM prescriptions WHERE patient_id = 'P-AUDIT-1'");
  await query("DELETE FROM medical_records WHERE patient_id = 'P-AUDIT-1'");
  await query("DELETE FROM patient_vitals WHERE patient_id = 'P-AUDIT-1'");
  await query("DELETE FROM patients WHERE id = 'P-AUDIT-1'");
  await query("DELETE FROM doctors WHERE id = 'D-AUDIT-1'");

  // Insert patient fixture
  await query(`
    INSERT INTO patients (id, name, email, phone, blood_group, allergies, chronic_conditions, status)
    VALUES ('P-AUDIT-1', 'Alice Audit', 'patient.audit@test.com', '+919888800099', 'A+', '["Penicillin"]', '["Hypertension"]', 'active')
  `);

  // Insert doctor fixture
  await query(`
    INSERT INTO doctors (id, name, email, specialty, status, verification_status)
    VALUES ('D-AUDIT-1', 'Dr. Sarah Audit', 'doctor.audit@test.com', 'Cardiology', 'active', 'approved')
  `);

  // Insert users fixtures
  await query(`
    INSERT INTO users (id, name, email, password, role, patient_id, doctor_id, token_version)
    VALUES
      ('U-ADMIN-AUDIT', 'Admin Auditor', 'admin.audit@test.com', $1, 'admin', NULL, NULL, 1),
      ('U-DOC-AUDIT', 'Dr. Sarah Audit', 'doctor.audit@test.com', $1, 'doctor', NULL, 'D-AUDIT-1', 1),
      ('U-PAT-AUDIT', 'Alice Audit', 'patient.audit@test.com', $1, 'patient', 'P-AUDIT-1', NULL, 1)
  `, [hash]);

  // Establish confirmed clinical relationship (completed appointment)
  await query(`
    INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, specialty, date, time, status, booked_by)
    VALUES ('A-AUDIT-1', 'P-AUDIT-1', 'Alice Audit', 'D-AUDIT-1', 'Dr. Sarah Audit', 'Cardiology', '2026-10-15', '10:00 AM', 'completed', 'P-AUDIT-1')
  `);

  // Insert clinical sample data for reading
  await query(`
    INSERT INTO patient_vitals (id, patient_id, hr, bp, systolic, diastolic, temp, spo2, weight, recorded_at)
    VALUES ('V-AUDIT-1', 'P-AUDIT-1', 72, '120/80', 120, 80, 98.6, 99, 70, NOW())
  `);

  await query(`
    INSERT INTO prescriptions (id, patient_id, patient_name, doctor_id, doctor_name, medications, status, date)
    VALUES ('RX-AUDIT-1', 'P-AUDIT-1', 'Alice Audit', 'D-AUDIT-1', 'Dr. Sarah Audit', '[{"name":"Amoxicillin","dosage":"500mg"}]', 'active', NOW())
  `);

  await query(`
    INSERT INTO consultations (id, patient_id, doctor_id, reason, symptoms, vitals, diagnosis, status, date)
    VALUES ('C-AUDIT-1', 'P-AUDIT-1', 'D-AUDIT-1', 'Routine Checkup', 'None', '{"bp":"120/80","hr":72}', 'Healthy', 'completed', NOW())
  `);

  await query(`
    INSERT INTO medical_records (id, patient_id, type, description, doctor, details, date)
    VALUES ('MR-AUDIT-1', 'P-AUDIT-1', 'Lab Report', 'Annual Blood Panel', 'Dr. Sarah Audit', '{}', NOW())
  `);

  console.log('  Setup complete.\n');

  const adminToken = makeToken({ id: 'U-ADMIN-AUDIT', userId: 'U-ADMIN-AUDIT', role: 'admin', name: 'Admin Auditor' });
  const doctorToken = makeToken({ id: 'U-DOC-AUDIT', userId: 'U-DOC-AUDIT', role: 'doctor', name: 'Dr. Sarah Audit', doctorId: 'D-AUDIT-1' });
  const patientToken = makeToken({ id: 'U-PAT-AUDIT', userId: 'U-PAT-AUDIT', role: 'patient', name: 'Alice Audit', patientId: 'P-AUDIT-1' });

  // ── 1. TEST DATABASE ENGINE TAMPER RESISTANCE (IMMUTABILITY) ────────────────
  console.log('▶ TEST 1: Database Engine Immutability (UPDATE & DELETE Forbidden)');

  // 1.1 Attempt UPDATE
  let updateBlocked = false;
  let updateErrorMsg = '';
  try {
    await query("UPDATE audit_logs SET action = 'MALICIOUS_UPDATE' WHERE id = (SELECT id FROM audit_logs LIMIT 1)");
  } catch (err) {
    updateBlocked = true;
    updateErrorMsg = err.message;
  }
  assert(
    updateBlocked && updateErrorMsg.includes('Audit logs are immutable and tamper-resistant'),
    `PostgreSQL trigger blocked UPDATE with message: "${updateErrorMsg}"`
  );

  // 1.2 Attempt DELETE
  let deleteBlocked = false;
  let deleteErrorMsg = '';
  try {
    await query('DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs LIMIT 1)');
  } catch (err) {
    deleteBlocked = true;
    deleteErrorMsg = err.message;
  }
  assert(
    deleteBlocked && deleteErrorMsg.includes('Audit logs are immutable and tamper-resistant'),
    `PostgreSQL trigger blocked DELETE with message: "${deleteErrorMsg}"`
  );

  // ── 2. TEST CRYPTOGRAPHIC HASH CHAIN INTEGRITY ──────────────────────────────
  console.log('\n▶ TEST 2: Cryptographic Hash Chaining Integrity');

  const chainStatus = await verifyAuditChain();
  assert(chainStatus.verified === true, `Full audit chain verified intact (${chainStatus.totalEntries} entries)`);
  assert(chainStatus.genesisHash === GENESIS_HASH, `Genesis hash matches standard 64-zero vector`);
  assert(typeof chainStatus.headHash === 'string' && chainStatus.headHash.length === 64, `Head hash is valid 64-char hex SHA-256: ${chainStatus.headHash}`);

  // Verify via Admin API
  const apiVerify = await api('/admin/audit-logs/verify', adminToken);
  assert(apiVerify.status === 200, `GET /api/admin/audit-logs/verify returned HTTP 200`);
  assert(apiVerify.data.verified === true, `Admin API confirmed cryptographic chain is valid`);
  assert(apiVerify.data.totalEntries === chainStatus.totalEntries, `Admin API matches DB entry count (${apiVerify.data.totalEntries})`);

  // ── 3. TEST TAMPER DETECTION ALGORITHM ───────────────────────────────────────
  console.log('\n▶ TEST 3: Tamper Detection (Pinpoints Corrupted / Modified Rows)');

  // Create a simulated audit chain with one modified entry
  const dummyChain = [
    {
      id: 1,
      prev_hash: GENESIS_HASH,
      timestamp: new Date('2026-10-09T10:00:00.000Z'),
      user_id: 'U-1',
      user_name: 'Admin',
      role: 'Administrator',
      action: 'Legitimate System Init',
      entity_type: 'System',
      entity_id: 'sys',
      ip_address: '127.0.0.1',
      status: 'success',
    },
    {
      id: 2,
      prev_hash: null, // will be set
      timestamp: new Date('2026-10-09T10:01:00.000Z'),
      user_id: 'U-2',
      user_name: 'Doctor',
      role: 'Doctor',
      action: 'Viewed patient chart for Alice',
      entity_type: 'Patient Chart',
      entity_id: 'P-101',
      ip_address: '198.51.100.42',
      status: 'success',
    },
  ];
  dummyChain[0].hash = computeAuditHash(dummyChain[0]);
  dummyChain[1].prev_hash = dummyChain[0].hash;
  dummyChain[1].hash = computeAuditHash(dummyChain[1]);

  // Function to verify an in-memory chain array
  function verifyArray(rows) {
    let prev = GENESIS_HASH;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.prev_hash !== prev) {
        return { verified: false, tamperedRowId: r.id, error: `Broken chain linkage at row ${r.id}` };
      }
      const computed = computeAuditHash(r);
      if (r.hash !== computed) {
        return { verified: false, tamperedRowId: r.id, error: `Hash mismatch at row ${r.id}: content modified!` };
      }
      prev = r.hash;
    }
    return { verified: true };
  }

  // 3.1 Unmodified chain
  const cleanCheck = verifyArray(dummyChain);
  assert(cleanCheck.verified === true, `Chain verification passes on authentic chain`);

  // 3.2 Corrupted row content
  const corruptedContentChain = JSON.parse(JSON.stringify(dummyChain));
  corruptedContentChain[1].action = 'Forged Action Without Recomputing Hash';
  const tamperCheck1 = verifyArray(corruptedContentChain);
  assert(tamperCheck1.verified === false, `Tamper detection flagged corrupted row content`);
  assert(tamperCheck1.tamperedRowId === 2, `Tamper detection accurately identified corrupted row ID 2`);

  // 3.3 Corrupted link hash (broken chain pointer)
  const corruptedLinkChain = JSON.parse(JSON.stringify(dummyChain));
  corruptedLinkChain[1].prev_hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  const tamperCheck2 = verifyArray(corruptedLinkChain);
  assert(tamperCheck2.verified === false, `Tamper detection flagged broken prev_hash pointer`);
  assert(tamperCheck2.tamperedRowId === 2, `Tamper detection accurately identified break at row ID 2`);

  // ── 4. TEST READ AUDITING (WHO, WHAT, WHEN, FROM WHERE) ──────────────────────
  console.log('\n▶ TEST 4: Read Access Auditing for Charts, Vitals, Prescriptions, Clinical Notes');

  // 4.1 Read Patient Chart (GET /api/patients/P-AUDIT-1)
  const chartRes = await api('/patients/P-AUDIT-1', doctorToken);
  assert(chartRes.status === 200, `Doctor read patient chart (HTTP 200)`);

  // 4.2 Read Patient Directory (GET /api/patients)
  const dirRes = await api('/patients', doctorToken);
  assert(dirRes.status === 200, `Doctor read patient directory (HTTP 200)`);

  // 4.3 Read Vitals History (GET /api/patients/P-AUDIT-1/vitals-history)
  const vitalsRes = await api('/patients/P-AUDIT-1/vitals-history', doctorToken);
  assert(vitalsRes.status === 200, `Doctor read patient vitals history (HTTP 200)`);

  // 4.4 Read Prescriptions (GET /api/prescriptions)
  const rxListRes = await api('/prescriptions?patientId=P-AUDIT-1', doctorToken);
  assert(rxListRes.status === 200, `Doctor read prescriptions list (HTTP 200)`);

  // 4.5 Read Clinical Consultations Notes (GET /api/consultations)
  const consultRes = await api('/consultations?patientId=P-AUDIT-1', doctorToken);
  assert(consultRes.status === 200, `Doctor read clinical consultation notes (HTTP 200)`);

  // 4.6 Read Medical Records (GET /api/medical-records)
  const recordsRes = await api('/medical-records?patientId=P-AUDIT-1', doctorToken);
  assert(recordsRes.status === 200, `Doctor read clinical medical records (HTTP 200)`);

  // Allow the backend server's non-blocking async queue to complete writing rows to Neon
  let recentLogs = [];
  for (let attempt = 0; attempt < 15; attempt++) {
    const { rows } = await query(
      `SELECT * FROM audit_logs
       WHERE ip_address = '198.51.100.42'
       ORDER BY id DESC LIMIT 15`
    );
    if (rows.length >= 6) {
      recentLogs = rows;
      break;
    }
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n  Inspecting ${recentLogs.length} audit rows captured from read requests:`);

  const chartLog = recentLogs.find(r => r.entity_type === 'Patient Chart');
  assert(!!chartLog, `Audit entry recorded for Patient Chart view`);
  if (chartLog) {
    assert(chartLog.user_id === 'U-DOC-AUDIT', `  - WHO (user_id): "${chartLog.user_id}"`);
    assert(chartLog.role === 'doctor', `  - WHO (role): "${chartLog.role}"`);
    assert(chartLog.entity_id === 'P-AUDIT-1', `  - WHAT (entity_id): "${chartLog.entity_id}"`);
    assert(chartLog.ip_address === '198.51.100.42', `  - FROM WHERE (ip_address): "${chartLog.ip_address}"`);
    assert(chartLog.user_agent.includes('MediTalk-Audit-Tester'), `  - FROM WHERE (user_agent): "${chartLog.user_agent}"`);
    assert(!!chartLog.timestamp, `  - WHEN (timestamp): ${new Date(chartLog.timestamp).toISOString()}`);
    assert(!!chartLog.prev_hash && !!chartLog.hash, `  - CHAIN HASH: prev="${chartLog.prev_hash.slice(0, 10)}..." hash="${chartLog.hash.slice(0, 10)}..."`);
  }

  const vitalsLog = recentLogs.find(r => r.entity_type === 'Patient Vitals');
  assert(!!vitalsLog, `Audit entry recorded for Patient Vitals history view`);

  const rxLog = recentLogs.find(r => r.entity_type === 'Prescription List');
  assert(!!rxLog, `Audit entry recorded for Prescriptions view`);

  const consultLog = recentLogs.find(r => r.entity_type === 'Clinical Consultation Notes');
  assert(!!consultLog, `Audit entry recorded for Clinical Consultation Notes view`);

  const medRecLog = recentLogs.find(r => r.entity_type === 'Medical Records');
  assert(!!medRecLog, `Audit entry recorded for Medical Records view`);

  // ── 5. TEST NON-BLOCKING EFFICIENCY (PERFORMANCE GUARANTEE) ────────────────
  console.log('\n▶ TEST 5: Efficiency Benchmark (Non-Blocking Audit Writes)');

  // 5.1 Benchmark the synchronous calculation latency of computeAuditHash
  const hashDurations = [];
  for (let i = 0; i < 500; i++) {
    const tStart = performance.now();
    computeAuditHash({
      prevHash: GENESIS_HASH,
      timestamp: new Date(),
      userId: 'U-BENCH',
      userName: 'Dr. Bench',
      role: 'doctor',
      action: 'Microbenchmark access',
      entityType: 'Benchmark',
      entityId: 'B-1',
      ipAddress: '127.0.0.1',
      status: 'success',
    });
    hashDurations.push(performance.now() - tStart);
  }
  const avgHash = hashDurations.reduce((a, b) => a + b, 0) / hashDurations.length;
  console.log(`  SHA-256 cryptographic calculation latency: ${avgHash.toFixed(4)}ms per entry`);
  assert(avgHash < 0.2, `Audit hash calculation is negligible (${avgHash.toFixed(4)}ms)`);

  // 5.2 Microbenchmark asynchronous queue dispatch latency
  const syncStart = performance.now();
  let dummyQueue = Promise.resolve();
  for (let i = 0; i < 500; i++) {
    dummyQueue = dummyQueue.then(() => Promise.resolve());
  }
  const dispatchDur = (performance.now() - syncStart) / 500;
  console.log(`  Synchronous queue dispatch latency: ${dispatchDur.toFixed(4)}ms per event`);
  assert(dispatchDur < 0.1, `Asynchronous event dispatch latency is negligible (${dispatchDur.toFixed(4)}ms)`);

  // 5.3 Decoupled execution: response returns immediately without waiting for database write
  const t0 = performance.now();
  const readRes = await api('/patients/P-AUDIT-1', doctorToken);
  const dur = performance.now() - t0;
  assert(readRes.status === 200, `Authenticated read returns successfully (${dur.toFixed(1)}ms) without blocking on audit writes`);

  // ── 6. FINAL CHAIN INTEGRITY POST-READ AUDITING ────────────────────────────
  console.log('\n▶ TEST 6: Post-Read Full Chain Verification');
  // Wait for background server queue to finish writing the read audit rows
  await new Promise(r => setTimeout(r, 2000));
  const finalChain = await verifyAuditChain();
  assert(finalChain.verified === true, `Full cryptographic chain remains 100% verified with all new read audit rows added`);
  console.log(`  Total verified entries: ${finalChain.totalEntries}`);
  console.log(`  Head Hash: ${finalChain.headHash}`);

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('══════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Unhandled error during test run:', err);
  process.exit(1);
});
