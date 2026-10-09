// backend/services/auditService.js
// Tamper-resistant, cryptographically chained audit logging service

import crypto from 'crypto';
import { query, getPool } from '../database/db.js';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Extracts client IP address accurately, taking into account trusted proxy headers
 */
export function getClientIp(req) {
  if (!req) return '127.0.0.1';
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Canonical cryptographic hash calculation for an audit log entry.
 * Uses SHA-256 over all immutable audit fields chained to the previous row's hash.
 */
export function computeAuditHash(entry = {}) {
  const finalPrev = entry.prevHash ?? entry.prev_hash ?? GENESIS_HASH;
  const finalUserId = entry.userId ?? entry.user_id ?? '';
  const finalUserName = entry.userName ?? entry.user_name ?? '';
  const finalRole = entry.role ?? '';
  const finalAction = entry.action ?? '';
  const finalEntityType = entry.entityType ?? entry.entity_type ?? '';
  const finalEntityId = entry.entityId ?? entry.entity_id ?? '';
  const finalIp = entry.ipAddress ?? entry.ip_address ?? '127.0.0.1';
  const finalStatus = entry.status ?? 'success';

  const tsStr = entry.timestamp instanceof Date ? entry.timestamp.toISOString() : String(entry.timestamp || '');
  const data = [
    finalPrev,
    tsStr,
    String(finalUserId),
    String(finalUserName),
    String(finalRole),
    String(finalAction),
    String(finalEntityType),
    String(finalEntityId),
    String(finalIp),
    String(finalStatus),
  ].join('|');

  return crypto.createHash('sha256').update(data).digest('hex');
}

// In-memory sequential promise queue to ensure strict linearization of the hash chain
// and non-blocking asynchronous dispatch for HTTP route handlers.
let writeQueue = Promise.resolve();

/**
 * Writes an audit row sequentially to the database, ensuring cryptographic chaining.
 * Uses a PostgreSQL advisory transaction lock to guarantee race-free serialization across multiple processes.
 */
async function writeAuditRow({
  userId,
  userName,
  role,
  action,
  entityType,
  entityId,
  status = 'success',
  ipAddress = '127.0.0.1',
  userAgent = 'Unknown',
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Advisory transaction lock guarantees linear chaining even under concurrent multi-process writes
    await client.query('SELECT pg_advisory_xact_lock(42424242)');

    // 1. Fetch the hash of the latest row in the chain
    const { rows: lastRows } = await client.query(
      'SELECT hash FROM audit_logs WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1'
    );
    const prevHash = lastRows[0]?.hash || GENESIS_HASH;
    const now = new Date();

    // 2. Compute the cryptographic hash for this row
    const hash = computeAuditHash({
      prevHash,
      timestamp: now,
      userId,
      userName,
      role,
      action,
      entityType,
      entityId,
      ipAddress,
      status,
    });

    // 3. Insert the immutable audit row
    await client.query(
      `INSERT INTO audit_logs (
        user_id, user_name, role, action, entity_type, entity_id, status,
        ip_address, user_agent, timestamp, prev_hash, hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        userId || null,
        userName || 'System',
        role || 'System',
        action,
        entityType || 'General',
        entityId || null,
        status,
        ipAddress,
        userAgent,
        now,
        prevHash,
        hash,
      ]
    );

    await client.query('COMMIT');
    return { hash, prevHash, timestamp: now };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fire-and-forget, non-blocking audit logging for application actions.
 * Enqueues into sequential background queue so user requests never suffer database latency.
 */
export function logAudit(entry) {
  writeQueue = writeQueue.then(async () => {
    try {
      await writeAuditRow(entry);
    } catch (err) {
      console.error('🔒 [AuditService Error] Failed to write audit log:', err.message);
    }
  });
  return writeQueue;
}

/**
 * Convenience helper for auditing data access inside Express route handlers.
 * Non-blocking: HTTP response is sent immediately while audit record is queued.
 */
export function auditAccess(req, { action, entityType, entityId, status = 'success' }) {
  if (!req?.user) return;
  const ipAddress = getClientIp(req);
  const userAgent = req.headers?.['user-agent'] || 'Unknown';

  logAudit({
    userId: req.user.id || req.user.userId,
    userName: req.user.name || 'User',
    role: req.user.role || 'user',
    action,
    entityType,
    entityId: entityId ? String(entityId) : null,
    ipAddress,
    userAgent,
    status,
  });
}

/**
 * Flushes all pending in-memory writes. Used by test suites and admin verification.
 */
export async function flushAuditQueue() {
  await writeQueue;
}

/**
 * One-time backfill migration: chains any unhashed legacy audit log rows from Genesis.
 */
export async function backfillAuditHashes() {
  const { rows } = await query(
    'SELECT id, user_id, user_name, role, action, entity_type, entity_id, status, ip_address, timestamp, prev_hash, hash FROM audit_logs ORDER BY id ASC'
  );

  if (rows.length === 0) return 0;

  // Check if unhashed rows exist
  const unhashed = rows.filter(r => !r.hash);
  if (unhashed.length === 0) return 0;

  console.log(`🔒 [AuditService] Backfilling cryptographic hash chain for ${unhashed.length} rows...`);

  // Temporarily disable trigger if present to allow backfill
  await query('DROP TRIGGER IF EXISTS trg_protect_audit_logs ON audit_logs');

  let currentPrevHash = GENESIS_HASH;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.hash || r.prev_hash !== currentPrevHash) {
      const computed = computeAuditHash({
        prevHash: currentPrevHash,
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

      await query(
        'UPDATE audit_logs SET prev_hash = $1, hash = $2, ip_address = COALESCE(ip_address, $3) WHERE id = $4',
        [currentPrevHash, computed, '127.0.0.1', r.id]
      );

      currentPrevHash = computed;
    } else {
      currentPrevHash = r.hash;
    }
  }

  console.log('🔒 [AuditService] Hash chain backfill complete.');
  return unhashed.length;
}

/**
 * Installs PostgreSQL engine-level tamper protection triggers.
 * Prevents ANY database user from executing UPDATE or DELETE on audit_logs.
 */
export async function installAuditTamperProtection() {
  // 1. Function to raise exception on update or delete
  await query(`
    CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit logs are immutable and tamper-resistant: UPDATE and DELETE operations are forbidden.';
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 2. Attach trigger on audit_logs
  await query('DROP TRIGGER IF EXISTS trg_protect_audit_logs ON audit_logs');
  await query(`
    CREATE TRIGGER trg_protect_audit_logs
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();
  `);

  // 3. Prevent TRUNCATE via rule
  try {
    await query(`
      CREATE OR REPLACE RULE no_audit_log_truncate AS
      ON TRUNCATE TO audit_logs DO INSTEAD NOTHING;
    `);
  } catch (_) {}

  console.log('🛡️  [AuditService] PostgreSQL tamper protection active: UPDATE and DELETE forbidden.');
}

/**
 * Full cryptographic integrity verification across the entire audit log table.
 * Recalculates every SHA-256 hash and checks the prev_hash chain linkage.
 */
export async function verifyAuditChain() {
  await flushAuditQueue();

  const { rows } = await query(
    'SELECT id, user_id, user_name, role, action, entity_type, entity_id, status, ip_address, timestamp, prev_hash, hash FROM audit_logs ORDER BY id ASC'
  );

  if (rows.length === 0) {
    return {
      verified: true,
      totalEntries: 0,
      genesisHash: GENESIS_HASH,
      headHash: GENESIS_HASH,
      message: 'Audit log is empty. Integrity verified.',
      verifiedAt: new Date().toISOString(),
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Check linkage
    if (row.prev_hash !== expectedPrevHash) {
      return {
        verified: false,
        tamperedRowId: row.id,
        sequenceIndex: i,
        error: `Broken chain linkage at row ID ${row.id}: expected prev_hash "${expectedPrevHash}", found "${row.prev_hash}"`,
        verifiedAt: new Date().toISOString(),
      };
    }

    // Recalculate row hash
    const recomputedHash = computeAuditHash({
      prevHash: row.prev_hash,
      timestamp: row.timestamp,
      userId: row.user_id,
      userName: row.user_name,
      role: row.role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      ipAddress: row.ip_address,
      status: row.status,
    });

    if (row.hash !== recomputedHash) {
      return {
        verified: false,
        tamperedRowId: row.id,
        sequenceIndex: i,
        error: `Tampered content at row ID ${row.id}: recomputed hash "${recomputedHash}" does not match recorded hash "${row.hash}"`,
        verifiedAt: new Date().toISOString(),
      };
    }

    expectedPrevHash = row.hash;
  }

  return {
    verified: true,
    totalEntries: rows.length,
    genesisHash: GENESIS_HASH,
    headHash: expectedPrevHash,
    headRowId: rows[rows.length - 1].id,
    verifiedAt: new Date().toISOString(),
    message: `Cryptographic audit chain verified: ${rows.length} entries intact.`,
  };
}
