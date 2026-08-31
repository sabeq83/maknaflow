import crypto from 'crypto';
import { getActiveTenantId } from './tenant-context.js';
import { pgQuery, withPgTransaction } from './db-pg.js';
import { calculateNextRun, calculateOccurrences } from './content-automation-schedule.js';
import { resolveMissedRuns } from './content-automation-missed-runs.js';

const NON_TERMINAL_RUNS=['queued','dispatching','retry_wait','job_created','planning','generating_creative','generating_start_frames','awaiting_approval','partially_approved','producing','syncing_contentflow'];
const PURGE_BLOCKER_RUNS=['queued','dispatching','retry_wait','producing']; // 'awaiting_approval' and 'job_created' are idle/human-input states and do not block schedule deletion
const DELETABLE_RUNS=['completed','failed','skipped','awaiting_approval']; // allow deletion of awaiting_approval runs
const TERMINAL_RUNS=['completed','failed','skipped'];
const parseJson=value=>typeof value==='string'?JSON.parse(value):value;
const previewToken=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function listAutomations() {
  const tenantId = getActiveTenantId();
  const result = await pgQuery(`SELECT s.*,
    (SELECT COUNT(*) FROM content_automation_runs r WHERE r.schedule_id=s.id) AS run_count
    FROM content_automation_schedules s WHERE tenant_id=$1 AND status <> 'archived' ORDER BY created_at DESC`, [tenantId]);
  return result.rows;
}
export async function getAutomation(id) {
  const r = await pgQuery('SELECT * FROM content_automation_schedules WHERE id=$1 AND tenant_id=$2', [id, getActiveTenantId()]); return r.rows[0] || null;
}
export async function createAutomation(data, actor) {
  const id = `cas_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`, tenantId = getActiveTenantId();
  const r = await pgQuery(`INSERT INTO content_automation_schedules
    (id,tenant_id,name,campaign_kind,brand_profile_id,product_id,brand_product_id,status,timezone,frequency,schedule_config_json,operator_request_json,missed_run_policy,grace_minutes,max_catch_up_runs,retry_policy_json,auto_pause_threshold,next_run_at,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [id,tenantId,data.name,data.campaign_kind,data.brand_profile_id,data.product_id,data.brand_product_id,data.status,data.timezone,data.frequency,JSON.stringify(data.schedule),JSON.stringify(data.operator_request),data.missed_run_policy,data.grace_minutes,data.max_catch_up_runs,JSON.stringify(data.retry_policy),data.auto_pause_threshold,data.next_run_at,actor]);
  return r.rows[0];
}
export async function createAutomationIdempotent(data, actor, idempotencyKey, bodyHash) {
  const tenantId = getActiveTenantId();
  return withPgTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`automation-create:${tenantId}:${idempotencyKey}`]);
    const replay = await client.query(`SELECT s.*,e.event_json FROM content_automation_audit_events e
      JOIN content_automation_schedules s ON s.id=e.schedule_id AND s.tenant_id=e.tenant_id
      WHERE e.tenant_id=$1 AND e.event_type='operator_schedule_created'
        AND e.event_json->>'idempotency_key'=$2 LIMIT 1`, [tenantId, idempotencyKey]);
    if (replay.rows[0]) {
      if (replay.rows[0].event_json?.body_sha256 !== bodyHash) {
        const error = new Error('Idempotency-Key sudah dipakai untuk payload berbeda.');
        error.code = 'IDEMPOTENCY_CONFLICT'; error.status = 409; throw error;
      }
      const { event_json: _event, ...schedule } = replay.rows[0];
      return { schedule, replayed: true };
    }
    const id = `cas_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const inserted = await client.query(`INSERT INTO content_automation_schedules
      (id,tenant_id,name,campaign_kind,brand_profile_id,product_id,brand_product_id,status,timezone,frequency,schedule_config_json,operator_request_json,missed_run_policy,grace_minutes,max_catch_up_runs,retry_policy_json,auto_pause_threshold,next_run_at,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [id,tenantId,data.name,data.campaign_kind,data.brand_profile_id,data.product_id,data.brand_product_id,data.status,data.timezone,data.frequency,JSON.stringify(data.schedule),JSON.stringify(data.operator_request),data.missed_run_policy,data.grace_minutes,data.max_catch_up_runs,JSON.stringify(data.retry_policy),data.auto_pause_threshold,data.next_run_at,actor]);
    await client.query(`INSERT INTO content_automation_audit_events
      (tenant_id,actor_id,event_type,schedule_id,event_json) VALUES($1,$2,'operator_schedule_created',$3,$4)`,
      [tenantId, actor, id, JSON.stringify({ idempotency_key: idempotencyKey, body_sha256: bodyHash })]);
    return { schedule: inserted.rows[0], replayed: false };
  });
}
export async function updateAutomation(id, data) {
  const r = await pgQuery(`UPDATE content_automation_schedules SET name=$1,campaign_kind=$2,brand_profile_id=$3,product_id=$4,brand_product_id=$5,status=$6,timezone=$7,frequency=$8,
    schedule_config_json=$9,operator_request_json=$10,missed_run_policy=$11,grace_minutes=$12,max_catch_up_runs=$13,
    retry_policy_json=$14,auto_pause_threshold=$15,next_run_at=$16,updated_at=CURRENT_TIMESTAMP
    WHERE id=$17 AND tenant_id=$18 RETURNING *`, [data.name,data.campaign_kind,data.brand_profile_id,data.product_id,data.brand_product_id,data.status,data.timezone,data.frequency,JSON.stringify(data.schedule),JSON.stringify(data.operator_request),data.missed_run_policy,data.grace_minutes,data.max_catch_up_runs,JSON.stringify(data.retry_policy),data.auto_pause_threshold,data.next_run_at,id,getActiveTenantId()]);
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

export async function listCalendarSchedules({scheduleId=null,brandId=null}={}) {
  const params=[getActiveTenantId()];
  let where="tenant_id=$1 AND status<>'archived'";
  if(scheduleId){params.push(scheduleId);where+=` AND id=$${params.length}`;}
  if(brandId){params.push(brandId);where+=` AND operator_request_json #>> '{planner,brand_id}'=$${params.length}`;}
  return (await pgQuery(`SELECT id,name,status,timezone,frequency,schedule_config_json,operator_request_json,
    consecutive_failure_count,auto_pause_threshold,next_run_at
    FROM content_automation_schedules WHERE ${where} ORDER BY name`,params)).rows;
}

export async function listCalendarRuns({from,to,scheduleId=null,brandId=null,statuses=[]}={}) {
  const params=[getActiveTenantId(),from,to];
  let where='r.tenant_id=$1 AND r.scheduled_for>=$2 AND r.scheduled_for<$3';
  if(scheduleId){params.push(scheduleId);where+=` AND r.schedule_id=$${params.length}`;}
  if(brandId){params.push(brandId);where+=` AND s.operator_request_json #>> '{planner,brand_id}'=$${params.length}`;}
  if(statuses.length){params.push(statuses);where+=` AND r.status=ANY($${params.length}::text[])`;}
  return (await pgQuery(`SELECT r.id,r.schedule_id,r.scheduled_for,r.status,r.attempt_count,r.error_code,r.error_message,
    r.skip_reason,r.next_attempt_at,r.operator_job_id,s.name AS schedule_name,s.timezone,
    s.operator_request_json #>> '{planner,brand_id}' AS brand_id,
    COALESCE(s.operator_request_json #>> '{planner,account_name}','') AS brand_account,
    o.campaign_id AS operator_campaign_id
    FROM content_automation_runs r JOIN content_automation_schedules s ON s.id=r.schedule_id
    LEFT JOIN operator_jobs o ON o.id=r.operator_job_id WHERE ${where} ORDER BY r.scheduled_for`,params)).rows;
}

export async function getAutomationRunHealth() {
  const tenantId=getActiveTenantId();
  const runs=(await pgQuery(`SELECT
    COUNT(*) FILTER(WHERE status='retry_wait')::int AS retry_wait,
    COUNT(*) FILTER(WHERE status='failed' AND created_at>=CURRENT_TIMESTAMP-INTERVAL '30 days')::int AS failed,
    COUNT(*) FILTER(WHERE status='awaiting_approval')::int AS awaiting_approval
    FROM content_automation_runs WHERE tenant_id=$1`,[tenantId])).rows[0];
  const schedules=(await pgQuery(`SELECT
    COUNT(*) FILTER(WHERE status='active' AND next_run_at<=CURRENT_TIMESTAMP)::int AS due,
    COUNT(*) FILTER(WHERE status='paused' AND consecutive_failure_count>=auto_pause_threshold)::int AS auto_paused
    FROM content_automation_schedules WHERE tenant_id=$1`,[tenantId])).rows[0];
  const outbox=(await pgQuery(`SELECT COUNT(*) FILTER(WHERE status='dead_letter')::int AS dead_letter
    FROM content_automation_notification_outbox WHERE tenant_id=$1`,[tenantId])).rows[0];
  return {...runs,...schedules,...outbox};
}

export async function claimDueAutomation(workerId,{tenantId=null}={}) {
  return withPgTransaction(async client => {
    const queued=await client.query(`SELECT r.*,s.name AS schedule_name,s.tenant_id AS schedule_tenant_id,s.operator_request_json,s.retry_policy_json,s.auto_pause_threshold
      FROM content_automation_runs r JOIN content_automation_schedules s ON s.id=r.schedule_id
      WHERE ((s.status='active' AND r.status='queued') OR (r.status='retry_wait' AND r.next_attempt_at<=CURRENT_TIMESTAMP))
      ${tenantId?'AND s.tenant_id=$1':''} ORDER BY COALESCE(r.next_attempt_at,r.scheduled_for),r.created_at FOR UPDATE OF r SKIP LOCKED LIMIT 1`,tenantId?[tenantId]:[]);
    if(queued.rows[0]){
      const claimed=(await client.query(`UPDATE content_automation_runs SET status='dispatching',attempt_count=attempt_count+1,last_attempt_at=CURRENT_TIMESTAMP,next_attempt_at=NULL,started_at=COALESCE(started_at,CURRENT_TIMESTAMP) WHERE id=$1 RETURNING *`,[queued.rows[0].id])).rows[0];
      return {schedule:{...queued.rows[0],id:queued.rows[0].schedule_id,name:queued.rows[0].schedule_name,tenant_id:queued.rows[0].schedule_tenant_id},run:claimed,workerId,reused:false};
    }
    const selected=await client.query(`SELECT * FROM content_automation_schedules WHERE status='active' AND next_run_at<=CURRENT_TIMESTAMP ${tenantId?'AND tenant_id=$1':''} ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1`,tenantId?[tenantId]:[]);
    const schedule=selected.rows[0]; if(!schedule) return null;
    const now=new Date(),config=parseJson(schedule.schedule_config_json);
    const from=new Date(new Date(schedule.next_run_at).getTime()-60000);
    const occurrences=calculateOccurrences({frequency:schedule.frequency,config,timezone:schedule.timezone,from,to:now,limit:500});
    const resolution=resolveMissedRuns({occurrences,policy:schedule.missed_run_policy,graceMinutes:schedule.grace_minutes,maxCatchUpRuns:schedule.max_catch_up_runs,now});
    for(const slot of resolution.skippedSlots){const id=`car_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`,key=`automation:${schedule.tenant_id}:${schedule.id}:${slot.toISOString()}`;await client.query(`INSERT INTO content_automation_runs(id,tenant_id,schedule_id,scheduled_for,idempotency_key,campaign_kind,status,attempt_count,skip_reason,completed_at) VALUES($1,$2,$3,$4,$5,$6,'skipped',0,'missed_run_policy',CURRENT_TIMESTAMP) ON CONFLICT(tenant_id,schedule_id,scheduled_for) DO NOTHING`,[id,schedule.tenant_id,schedule.id,slot,key,schedule.campaign_kind||'brand_editorial']);}
    for(const slot of resolution.runnableSlots){const id=`car_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`,key=`automation:${schedule.tenant_id}:${schedule.id}:${slot.toISOString()}`;await client.query(`INSERT INTO content_automation_runs(id,tenant_id,schedule_id,scheduled_for,idempotency_key,campaign_kind,status,attempt_count) VALUES($1,$2,$3,$4,$5,$6,'queued',0) ON CONFLICT(tenant_id,schedule_id,scheduled_for) DO NOTHING`,[id,schedule.tenant_id,schedule.id,slot,key,schedule.campaign_kind||'brand_editorial']);}
    const nextRunAt=calculateNextRun({frequency:schedule.frequency,config,timezone:schedule.timezone,after:now});
    await client.query('UPDATE content_automation_schedules SET last_run_at=$1,next_run_at=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3',[occurrences.at(-1)||schedule.next_run_at,nextRunAt,schedule.id]);
    const missedMeta=resolution.skippedSlots.length?{skipped_count:resolution.skippedSlots.length,event_key:`schedule:${schedule.id}:missed:${resolution.skippedSlots.at(-1).toISOString()}`}:{skipped_count:0,event_key:null};
    if(!resolution.runnableSlots.length)return {schedule,run:null,workerId,skippedOnly:true,missedMeta};
    const first=(await client.query(`SELECT * FROM content_automation_runs WHERE tenant_id=$1 AND schedule_id=$2 AND scheduled_for=$3 FOR UPDATE`,[schedule.tenant_id,schedule.id,resolution.runnableSlots[0]])).rows[0];
    const claimed=(await client.query(`UPDATE content_automation_runs SET status='dispatching',attempt_count=attempt_count+1,last_attempt_at=CURRENT_TIMESTAMP,started_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='queued' RETURNING *`,[first.id])).rows[0];
    return claimed?{schedule,run:claimed,workerId,reused:false,missedMeta}:{schedule,run:first,workerId,reused:true,missedMeta};
  });
}
export async function createRunNow(schedule) {
  const tenantId=getActiveTenantId(), slot=new Date(); slot.setMilliseconds(0);
  const id=`car_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`, key=`automation-now:${tenantId}:${schedule.id}:${slot.toISOString()}`;
  return (await pgQuery(`INSERT INTO content_automation_runs(id,tenant_id,schedule_id,scheduled_for,idempotency_key,campaign_kind,status,started_at,attempt_count)
    VALUES($1,$2,$3,$4,$5,$6,'dispatching',CURRENT_TIMESTAMP,1) RETURNING *`,[id,tenantId,schedule.id,slot,key,schedule.campaign_kind||'brand_editorial'])).rows[0];
}
export async function updateRun(id, fields) {
  const allowed=['operator_job_id','status','error_code','error_message','completed_at','next_attempt_at','last_attempt_at','failure_class','skip_reason','campaign_kind','product_snapshot_json','review_revision','approved_item_count','total_item_count','contentflow_synced_count']; const entries=Object.entries(fields).filter(([k])=>allowed.includes(k));
  if(!entries.length)return null; const values=entries.map(([,v])=>v); values.push(id);
  return (await pgQuery(`UPDATE content_automation_runs SET ${entries.map(([k],i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${values.length} RETURNING *`,values)).rows[0]||null;
}
export async function advanceSchedule(schedule,nextRunAt){await pgQuery('UPDATE content_automation_schedules SET last_run_at=next_run_at,next_run_at=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3',[nextRunAt,schedule.id,schedule.tenant_id]);}
export async function createNotification(run,type,title,message,actionUrl){await pgQuery(`INSERT INTO content_automation_notifications(tenant_id,run_id,type,title,message,action_url) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,run_id,type) DO NOTHING`,[run.tenant_id,run.id,type,title,message,actionUrl]);}
export async function listRunsToReconcile(){return (await pgQuery(`SELECT r.*,s.name AS schedule_name,o.status AS operator_status,o.current_stage FROM content_automation_runs r JOIN content_automation_schedules s ON s.id=r.schedule_id LEFT JOIN operator_jobs o ON o.id=r.operator_job_id WHERE r.status IN('job_created','generating_creative','generating_start_frames','awaiting_approval','partially_approved','producing','syncing_contentflow') ORDER BY r.created_at LIMIT 100`)).rows;}

export async function recordScheduleOutcome(scheduleId,success){return (await pgQuery(`UPDATE content_automation_schedules SET consecutive_failure_count=CASE WHEN $2 THEN 0 ELSE consecutive_failure_count+1 END,status=CASE WHEN NOT $2 AND consecutive_failure_count+1>=auto_pause_threshold THEN 'paused' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *,((NOT $2) AND status='paused' AND consecutive_failure_count=auto_pause_threshold) AS just_auto_paused`,[scheduleId,success])).rows[0]||null;}
export async function createAutomationAuditEvent({tenantId,actor='system',type,scheduleId=null,runId=null,event={}}){await pgQuery(`INSERT INTO content_automation_audit_events(tenant_id,actor_id,event_type,schedule_id,run_id,event_json) VALUES($1,$2,$3,$4,$5,$6)`,[tenantId,actor,type,scheduleId,runId,JSON.stringify(event)]);}

export async function previewSchedulePurge(id){const tenantId=getActiveTenantId();const schedule=(await pgQuery('SELECT id,name,status FROM content_automation_schedules WHERE id=$1 AND tenant_id=$2',[id,tenantId])).rows[0];if(!schedule)return null;const counts=(await pgQuery(`SELECT COUNT(*)::int AS run_count,COUNT(*) FILTER(WHERE status=ANY($3))::int AS blocker_count FROM content_automation_runs WHERE schedule_id=$1 AND tenant_id=$2`,[id,tenantId,PURGE_BLOCKER_RUNS])).rows[0];const preview={schedule_id:id,schedule_name:schedule.name,run_count:counts.run_count,blocker_count:counts.blocker_count};return {...preview,preview_token:previewToken(preview)};}
export async function purgeSchedule(id,{actor,confirmationName,previewToken:token}){const preview=await previewSchedulePurge(id);if(!preview){const e=new Error('Schedule tidak ditemukan.');e.status=404;throw e;}if(preview.blocker_count){const e=new Error(`${preview.blocker_count} run non-terminal masih aktif.`);e.status=409;throw e;}if(confirmationName!==preview.schedule_name||token!==preview.preview_token){const e=new Error('Konfirmasi atau preview sudah tidak valid.');e.status=409;throw e;}return withPgTransaction(async client=>{const tenantId=getActiveTenantId();await client.query('LOCK TABLE content_automation_runs IN SHARE ROW EXCLUSIVE MODE');const locked=(await client.query('SELECT id,name FROM content_automation_schedules WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[id,tenantId])).rows[0];if(!locked){const e=new Error('Schedule tidak ditemukan.');e.status=404;throw e;}const blockers=Number((await client.query('SELECT COUNT(*) AS count FROM content_automation_runs WHERE schedule_id=$1 AND tenant_id=$2 AND status=ANY($3::text[])',[id,tenantId,PURGE_BLOCKER_RUNS])).rows[0].count);if(blockers){const e=new Error(`${blockers} run non-terminal masih aktif.`);e.status=409;throw e;}await client.query(`INSERT INTO content_automation_audit_events(tenant_id,actor_id,event_type,schedule_id,event_json) VALUES($1,$2,'schedule_purged',$3,$4)`,[tenantId,actor,id,JSON.stringify(preview)]);await client.query('DELETE FROM content_automation_schedules WHERE id=$1 AND tenant_id=$2',[id,tenantId]);return preview;});}
export async function purgeRun(id,{actor}){const tenantId=getActiveTenantId();return withPgTransaction(async client=>{const run=(await client.query('SELECT * FROM content_automation_runs WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[id,tenantId])).rows[0];if(!run){const e=new Error('Run tidak ditemukan.');e.status=404;throw e;}if(!DELETABLE_RUNS.includes(run.status)){const e=new Error('Run ini tidak dapat dihapus saat ini.');e.status=409;throw e;}await client.query(`INSERT INTO content_automation_audit_events(tenant_id,actor_id,event_type,schedule_id,run_id,event_json) VALUES($1,$2,'run_purged',$3,$4,$5)`,[tenantId,actor,run.schedule_id,run.id,JSON.stringify({status:run.status,operator_job_id:run.operator_job_id})]);await client.query('DELETE FROM content_automation_runs WHERE id=$1 AND tenant_id=$2',[id,tenantId]);return run;});}
function historyWhere(filters,params){let where=`tenant_id=$1 AND status=ANY($2::text[])`;params.push(filters.statuses?.length?filters.statuses.filter(x=>DELETABLE_RUNS.includes(x)):DELETABLE_RUNS);if(filters.schedule_id){params.push(filters.schedule_id);where+=` AND schedule_id=$${params.length}`;}if(filters.before){params.push(filters.before);where+=` AND created_at<$${params.length}`;}return where;}
export async function previewRunHistoryPurge(filters={}){const params=[getActiveTenantId()],where=historyWhere(filters,params);const row=(await pgQuery(`SELECT COUNT(*)::int AS run_count,MIN(created_at) AS oldest,MAX(created_at) AS newest,COALESCE(array_agg(id ORDER BY id) FILTER(WHERE id IS NOT NULL),ARRAY[]::text[]) AS run_ids FROM content_automation_runs WHERE ${where}`,params)).rows[0];const preview={filters:{schedule_id:filters.schedule_id||null,statuses:params[1],before:filters.before||null},...row};return {...preview,preview_token:previewToken(preview)};}
export async function purgeRunHistory(filters,{actor,previewToken:token}){const preview=await previewRunHistoryPurge(filters);if(token!==preview.preview_token){const e=new Error('Preview run history sudah berubah. Muat preview ulang.');e.status=409;throw e;}const tenantId=getActiveTenantId();return withPgTransaction(async client=>{await client.query(`INSERT INTO content_automation_audit_events(tenant_id,actor_id,event_type,event_json) VALUES($1,$2,'run_history_purged',$3)`,[tenantId,actor,JSON.stringify({...preview,run_ids:undefined})]);const deleted=await client.query(`DELETE FROM content_automation_runs WHERE tenant_id=$1 AND id=ANY($2::text[]) AND status=ANY($3::text[]) RETURNING id`,[tenantId,preview.run_ids,DELETABLE_RUNS]);if(deleted.rowCount!==preview.run_count)throw new Error('Run history berubah saat purge. Transaksi dibatalkan.');return {deleted_count:deleted.rowCount};});}
