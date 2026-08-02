import crypto from 'crypto';
import { getActiveTenantId } from './tenant-context.js';
import { pgQuery, withPgTransaction } from './db-pg.js';

export async function listAutomations() {
  const tenantId = getActiveTenantId();
  const result = await pgQuery(`SELECT s.*,
    (SELECT COUNT(*) FROM content_automation_runs r WHERE r.schedule_id=s.id) AS run_count
    FROM content_automation_schedules s WHERE tenant_id=$1 ORDER BY created_at DESC`, [tenantId]);
  return result.rows;
}
export async function getAutomation(id) {
  const r = await pgQuery('SELECT * FROM content_automation_schedules WHERE id=$1 AND tenant_id=$2', [id, getActiveTenantId()]); return r.rows[0] || null;
}
export async function createAutomation(data, actor) {
  const id = `cas_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`, tenantId = getActiveTenantId();
  const r = await pgQuery(`INSERT INTO content_automation_schedules
    (id,tenant_id,name,status,timezone,frequency,schedule_config_json,operator_request_json,missed_run_policy,grace_minutes,next_run_at,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [id,tenantId,data.name,data.status,data.timezone,data.frequency,JSON.stringify(data.schedule),JSON.stringify(data.operator_request),data.missed_run_policy,data.grace_minutes,data.next_run_at,actor]);
  return r.rows[0];
}
export async function updateAutomation(id, data) {
  const r = await pgQuery(`UPDATE content_automation_schedules SET name=$1,status=$2,timezone=$3,frequency=$4,
    schedule_config_json=$5,operator_request_json=$6,missed_run_policy=$7,grace_minutes=$8,next_run_at=$9,updated_at=CURRENT_TIMESTAMP
    WHERE id=$10 AND tenant_id=$11 RETURNING *`, [data.name,data.status,data.timezone,data.frequency,JSON.stringify(data.schedule),JSON.stringify(data.operator_request),data.missed_run_policy,data.grace_minutes,data.next_run_at,id,getActiveTenantId()]);
  return r.rows[0] || null;
}
export async function archiveAutomation(id) { return (await pgQuery("UPDATE content_automation_schedules SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2 RETURNING *",[id,getActiveTenantId()])).rows[0] || null; }
export async function listRuns(scheduleId = null, limit = 50) {
  const tenantId=getActiveTenantId(), params=[tenantId]; let where='r.tenant_id=$1';
  if(scheduleId){params.push(scheduleId);where+=' AND r.schedule_id=$2';} params.push(limit);
  return (await pgQuery(`SELECT r.*,s.name AS schedule_name,o.result_json AS operator_result_json,o.campaign_id AS operator_campaign_id
    FROM content_automation_runs r JOIN content_automation_schedules s ON s.id=r.schedule_id
    LEFT JOIN operator_jobs o ON o.id=r.operator_job_id
    WHERE ${where} ORDER BY r.created_at DESC LIMIT $${params.length}`,params)).rows;
}
export async function getRun(id) { return (await pgQuery(`SELECT r.*,s.operator_request_json,s.name AS schedule_name
  FROM content_automation_runs r JOIN content_automation_schedules s ON s.id=r.schedule_id
  WHERE r.id=$1 AND r.tenant_id=$2`,[id,getActiveTenantId()])).rows[0]||null; }
export async function prepareRunRetry(id) {
  const tenantId=getActiveTenantId();
  const result=await pgQuery(`UPDATE content_automation_runs SET status='dispatching',attempt_count=attempt_count+1,
    idempotency_key='automation-retry:' || tenant_id || ':' || id || ':' || (attempt_count+1),
    operator_job_id=NULL,error_code=NULL,error_message=NULL,completed_at=NULL,started_at=CURRENT_TIMESTAMP
    WHERE id=$1 AND tenant_id=$2 AND status='failed' RETURNING *`,[id,tenantId]);
  return result.rows[0]||null;
}
export async function listNotifications() { return (await pgQuery(`SELECT * FROM content_automation_notifications WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50`,[getActiveTenantId()])).rows; }
export async function markNotificationsRead() { await pgQuery('UPDATE content_automation_notifications SET read_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND read_at IS NULL',[getActiveTenantId()]); }

export async function claimDueAutomation(workerId) {
  return withPgTransaction(async client => {
    const selected=await client.query(`SELECT * FROM content_automation_schedules WHERE status='active' AND next_run_at<=CURRENT_TIMESTAMP ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1`);
    const schedule=selected.rows[0]; if(!schedule) return null;
    const scheduledFor=new Date(schedule.next_run_at), tenantId=schedule.tenant_id;
    const runId=`car_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`;
    const key=`automation:${tenantId}:${schedule.id}:${scheduledFor.toISOString()}`;
    const inserted=await client.query(`INSERT INTO content_automation_runs(id,tenant_id,schedule_id,scheduled_for,idempotency_key,status,started_at,attempt_count)
      VALUES($1,$2,$3,$4,$5,'dispatching',CURRENT_TIMESTAMP,1) ON CONFLICT(tenant_id,schedule_id,scheduled_for) DO NOTHING RETURNING *`,[runId,tenantId,schedule.id,scheduledFor,key]);
    if (inserted.rows[0]) return { schedule, run: inserted.rows[0], workerId, reused: false };
    const existing=await client.query(`SELECT * FROM content_automation_runs
      WHERE tenant_id=$1 AND schedule_id=$2 AND scheduled_for=$3`,[tenantId,schedule.id,scheduledFor]);
    return existing.rows[0] ? { schedule, run: existing.rows[0], workerId, reused: true } : null;
  });
}
export async function createRunNow(schedule) {
  const tenantId=getActiveTenantId(), slot=new Date(); slot.setMilliseconds(0);
  const id=`car_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`, key=`automation-now:${tenantId}:${schedule.id}:${slot.toISOString()}`;
  return (await pgQuery(`INSERT INTO content_automation_runs(id,tenant_id,schedule_id,scheduled_for,idempotency_key,status,started_at,attempt_count)
    VALUES($1,$2,$3,$4,$5,'dispatching',CURRENT_TIMESTAMP,1) RETURNING *`,[id,tenantId,schedule.id,slot,key])).rows[0];
}
export async function updateRun(id, fields) {
  const allowed=['operator_job_id','status','error_code','error_message','completed_at']; const entries=Object.entries(fields).filter(([k])=>allowed.includes(k));
  if(!entries.length)return null; const values=entries.map(([,v])=>v); values.push(id);
  return (await pgQuery(`UPDATE content_automation_runs SET ${entries.map(([k],i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${values.length} RETURNING *`,values)).rows[0]||null;
}
export async function advanceSchedule(schedule,nextRunAt){await pgQuery('UPDATE content_automation_schedules SET last_run_at=next_run_at,next_run_at=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3',[nextRunAt,schedule.id,schedule.tenant_id]);}
export async function createNotification(run,type,title,message,actionUrl){await pgQuery(`INSERT INTO content_automation_notifications(tenant_id,run_id,type,title,message,action_url) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,run_id,type) DO NOTHING`,[run.tenant_id,run.id,type,title,message,actionUrl]);}
export async function listRunsToReconcile(){return (await pgQuery(`SELECT r.*,s.name AS schedule_name,o.status AS operator_status,o.current_stage FROM content_automation_runs r JOIN content_automation_schedules s ON s.id=r.schedule_id LEFT JOIN operator_jobs o ON o.id=r.operator_job_id WHERE r.status IN('job_created','awaiting_approval','producing') ORDER BY r.created_at LIMIT 100`)).rows;}
