import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'meditalk_dev_secret_2026';
const BASE = 'http://localhost:3001/api';

function mintToken(role = 'admin') {
  return jwt.sign(
    {
      jti: 'load-' + Math.random(),
      id: 'U-load-tester',
      userId: 'U-load-tester',
      name: 'Load Tester',
      email: 'loadtest@meditalk.com',
      role,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runBatch(label, url, concurrency, total, token = null) {
  console.log(`\n--- Running Load Test: ${label} ---`);
  console.log(`Endpoint: ${url} | Concurrency: ${concurrency} | Total Requests: ${total}`);

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const latencies = [];
  let successCount = 0;
  let failCount = 0;
  const statusCodes = {};

  const startAll = Date.now();
  let completed = 0;

  async function worker() {
    while (completed < total) {
      completed++;
      const t0 = Date.now();
      try {
        const res = await fetch(url, { headers });
        const latency = Date.now() - t0;
        latencies.push(latency);
        statusCodes[res.status] = (statusCodes[res.status] || 0) + 1;
        if (res.ok) successCount++;
        else failCount++;
      } catch (err) {
        const latency = Date.now() - t0;
        latencies.push(latency);
        failCount++;
        statusCodes['ERR'] = (statusCodes['ERR'] || 0) + 1;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalTimeSec = (Date.now() - startAll) / 1000;
  latencies.sort((a, b) => a - b);
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const rps = (total / totalTimeSec).toFixed(1);

  console.log(`Results for ${label}:`);
  console.log(`  Duration: ${totalTimeSec.toFixed(2)}s | Throughput: ${rps} req/sec`);
  console.log(`  Success: ${successCount}/${total} (${((successCount/total)*100).toFixed(1)}%) | Failures: ${failCount}`);
  console.log(`  Latency: Avg ${avg}ms | p50 ${p50}ms | p95 ${p95}ms | p99 ${p99}ms | Max ${latencies[latencies.length-1]}ms`);
  console.log(`  Status breakdown:`, statusCodes);

  // Check health stats afterwards
  try {
    const hRes = await fetch(`${BASE}/health`);
    const hData = await hRes.json();
    console.log(`  DB Pool state after batch: Total: ${hData.pool?.totalCount}, Idle: ${hData.pool?.idleCount}, Waiting: ${hData.pool?.waitingCount}`);
  } catch (_) {}
}

async function main() {
  console.log('====================================================');
  console.log('MEDITALK SYSTEM RELIABILITY & CONCURRENCY LOAD TEST');
  console.log('====================================================');

  const adminToken = mintToken('admin');

  // Test 1: Healthcheck under load (50 concurrent, 100 requests)
  await runBatch('Healthcheck Route', `${BASE}/health`, 25, 100);

  // Test 2: Database-heavy Doctors Directory (20 concurrent, 60 requests)
  await runBatch('Doctors Directory (DB Query)', `${BASE}/doctors`, 15, 60, adminToken);

  // Test 3: Appointments Directory (15 concurrent, 50 requests)
  await runBatch('Appointments List (DB Query)', `${BASE}/appointments`, 15, 50, adminToken);

  console.log('\n====================================================');
  console.log('LOAD TEST COMPLETED');
  console.log('====================================================');
}

main();
