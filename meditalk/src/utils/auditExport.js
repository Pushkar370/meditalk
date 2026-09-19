/**
 * Exports audit log records to an RFC-4180 compliant CSV file and triggers download.
 * @param {Array<object>} logs - Array of audit log objects
 * @param {string} filename - Optional file name
 */
export function exportAuditLogsCsv(logs = [], filename) {
  if (!logs || logs.length === 0) return false;

  const headers = [
    'Log ID',
    'Timestamp (UTC)',
    'User Name',
    'User ID',
    'Role',
    'Action / Event',
    'Resource Type',
    'Reference ID',
    'Status',
  ];

  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  const rows = logs.map((log) => [
    log.id || '',
    log.timestamp ? new Date(log.timestamp).toISOString() : '',
    log.user_name || '',
    log.user_id || '',
    log.role || '',
    log.action || '',
    log.entity_type || '',
    log.entity_id || '',
    log.status || '',
  ]);

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = filename || `meditalk-audit-logs-${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
