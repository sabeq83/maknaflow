import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env,loadStagingEnv());
const { pgQuery,getPgPool }=await import('../lib/db-pg.js');
const { tenantContext }=await import('../lib/tenant-context.js');
const { claimDueAutomation }=await import('../lib/content-automation-repository.js');
const { claimNotification,enqueueExternalNotification,recoverStaleOutbox }=await import('../lib/notification-outbox-repository.js');

const suffix=crypto.randomUUID().replaceAll('-','').slice(0,10),tenant=`test_phase2d_${suffix}`,scheduleId=`cas_${suffix}`;
try{
  await pgQuery(`INSERT INTO content_automation_schedules(id,tenant_id,name,status,timezone,frequency,schedule_config_json,operator_request_json,missed_run_policy,grace_minutes,retry_policy_json,next_run_at)
    VALUES($1,$2,'Phase 2D Restart Pilot','active','Asia/Jakarta','daily','{"hour":8,"minute":0}'::jsonb,'{}'::jsonb,'run_latest',60,'{"max_attempts":3,"base_seconds":1,"max_seconds":2}'::jsonb,CURRENT_TIMESTAMP-INTERVAL '2 days')`,[scheduleId,tenant]);
  const first=await claimDueAutomation('phase2d-before-restart',{tenantId:tenant});
  assert.ok(first?.run,'missed run terbaru harus diklaim');
  const duplicate=await claimDueAutomation('phase2d-competing-worker',{tenantId:tenant});
  assert.equal(duplicate,null,'worker kedua tidak boleh memperoleh slot yang sama');
  const counts=(await pgQuery(`SELECT COUNT(*)::int AS total,COUNT(DISTINCT scheduled_for)::int AS unique_slots FROM content_automation_runs WHERE tenant_id=$1`,[tenant])).rows[0];
  assert.equal(counts.total,counts.unique_slots,'restart tidak boleh membuat slot duplikat');

  await pgQuery("UPDATE content_automation_runs SET status='retry_wait',next_attempt_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE id=$1",[first.run.id]);
  const retry=await claimDueAutomation('phase2d-after-restart',{tenantId:tenant});
  assert.equal(retry.run.id,first.run.id,'retry setelah restart harus melanjutkan run yang sama');

  await pgQuery(`INSERT INTO content_automation_notification_preferences(tenant_id,enabled,channel,chat_id,bot_token_ciphertext,events_json,timezone,updated_by)
    VALUES($1,TRUE,'telegram','phase2d-chat','v1.fake.fake.fake','["failed"]'::jsonb,'Asia/Jakarta','phase2d')`,[tenant]);
  const outbox=await enqueueExternalNotification({tenantId:tenant,scheduleId,eventKey:`phase2d:${suffix}`,eventType:'failed',title:'Recovery',message:'Test',actionUrl:'/content-automations'});
  await pgQuery("UPDATE content_automation_notification_outbox SET status='sending',locked_at=CURRENT_TIMESTAMP-INTERVAL '10 minutes',locked_by='dead-worker' WHERE id=$1",[outbox.id]);
  await recoverStaleOutbox();
  const recovered=await claimNotification('phase2d-notification-restart',{tenantId:tenant});
  assert.equal(recovered.id,outbox.id,'outbox stale harus dapat diklaim ulang setelah restart');
  console.log('Content automation Phase 2D restart, missed-run, retry, dedupe, and outbox recovery tests passed.');
}finally{
  await pgQuery('DELETE FROM content_automation_notification_outbox WHERE tenant_id=$1',[tenant]).catch(()=>{});
  await pgQuery('DELETE FROM content_automation_notification_preferences WHERE tenant_id=$1',[tenant]).catch(()=>{});
  await pgQuery('DELETE FROM content_automation_schedules WHERE tenant_id=$1',[tenant]).catch(()=>{});
  await pgQuery('DELETE FROM content_automation_audit_events WHERE tenant_id=$1',[tenant]).catch(()=>{});
  await getPgPool().end();
}
