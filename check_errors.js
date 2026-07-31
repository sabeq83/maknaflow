const { getDb } = require('./lib/db.js');
const db = getDb();
console.log('--- LATEST SCHEDULER JOBS ---');
const jobs = await db.prepare('SELECT id, queue_name, status, error_note, created_at FROM scheduler_jobs ORDER BY created_at DESC LIMIT 5').all();
console.log(JSON.stringify(jobs, null, 2));

console.log('--- LATEST SYSTEM AUDIT LOGS ---');
const logs = await db.prepare('SELECT id, severity_level, module_name, error_message, created_at FROM system_audit_logs ORDER BY created_at DESC LIMIT 5').all();
console.log(JSON.stringify(logs, null, 2));

console.log('--- LATEST FAILED SHEETS JOBS ---');
const failedSheets = await db.prepare("SELECT id, campaign_id, row_index, status, url_or_topic, created_at FROM sheets_jobs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 5").all();
console.log(JSON.stringify(failedSheets, null, 2));
