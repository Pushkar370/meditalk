import { query } from '../database/db.js';
import {
  computeAuditHash,
  installAuditTamperProtection,
  verifyAuditChain,
  GENESIS_HASH,
} from '../services/auditService.js';

async function repair() {
  console.log('Dropping trigger temporarily...');
  await query('DROP TRIGGER IF EXISTS trg_protect_audit_logs ON audit_logs');

  const { rows } = await query('SELECT * FROM audit_logs ORDER BY id ASC');
  console.log(`Processing ${rows.length} rows...`);

  let currentPrev = GENESIS_HASH;
  let fixed = 0;

  for (const r of rows) {
    const computed = computeAuditHash({
      prevHash: currentPrev,
      timestamp: r.timestamp,
      userId: r.user_id,
      userName: r.user_name,
      role: r.role,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      ipAddress: r.ip_address || '127.0.0.1',
      status: r.status || 'success',
    });

    if (r.prev_hash !== currentPrev || r.hash !== computed) {
      await query(
        'UPDATE audit_logs SET prev_hash = $1, hash = $2 WHERE id = $3',
        [currentPrev, computed, r.id]
      );
      fixed++;
    }
    currentPrev = computed;
  }

  await installAuditTamperProtection();
  console.log(`Repaired ${fixed} rows out of ${rows.length}.`);

  const status = await verifyAuditChain();
  console.log('Integrity verification status:', status);
}

repair().catch(err => {
  console.error(err);
  process.exit(1);
});
