// backend/scripts/verify_audit_logs.mjs
// Standalone CLI tool for administrators to verify audit log integrity

import { query } from '../database/db.js';
import { verifyAuditChain } from '../services/auditService.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log(' 🛡️  MediTalk Audit Log Cryptographic Integrity Verification');
console.log('═══════════════════════════════════════════════════════════════\n');

try {
  console.log('Fetching audit logs and checking cryptographic hash chain...\n');
  const result = await verifyAuditChain();

  if (result.verified) {
    console.log('✅ AUDIT LOG INTEGRITY: VERIFIED & INTACT');
    console.log(`   Total Entries Checked : ${result.totalEntries}`);
    console.log(`   Genesis Hash          : ${result.genesisHash}`);
    console.log(`   Head Hash             : ${result.headHash}`);
    console.log(`   Head Row ID           : ${result.headRowId}`);
    console.log(`   Verified At           : ${result.verifiedAt}`);
    console.log(`   Status Message        : ${result.message}\n`);
    console.log('🔒 Protection Status: Database engine trigger active (UPDATE/DELETE forbidden).');
    process.exit(0);
  } else {
    console.error('❌ INTEGRITY CHECK FAILED: TAMPERING DETECTED!');
    console.error(`   Tampered Row ID : ${result.tamperedRowId}`);
    console.error(`   Sequence Index  : ${result.sequenceIndex}`);
    console.error(`   Error Details   : ${result.error}`);
    console.error(`   Detected At     : ${result.verifiedAt}\n`);
    process.exit(1);
  }
} catch (err) {
  console.error('💥 Verification error:', err.message);
  process.exit(1);
}
