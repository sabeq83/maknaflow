import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env,loadStagingEnv());
const { pgQuery } = await import('../lib/db-pg.js');
const { tenantContext } = await import('../lib/tenant-context.js');
const { claimDueAutomation,previewSchedulePurge,purgeRun,purgeSchedule,previewRunHistoryPurge,purgeRunHistory,recordScheduleOutcome } = await import('../lib/content-automation-repository.js');
const { claimNotification,enqueueExternalNotification,markNotificationSent } = await import('../lib/notification-outbox-repository.js');
const { getAutomationCalendar } = await import('../lib/content-automation-calendar.js');

const suffix=crypto.randomUUID().replaceAll('-','').slice(0,10);
const tenant=`test_phase2_${suffix}`,scheduleId=`cas_${suffix}`,schedule2=`cas_${suffix}_bulk`;
const runFailed=`car_${suffix}_failed`,runActive=`car_${suffix}_active`;

for(let attempt=0;attempt<50;attempt++){
  const ready=(await pgQuery("SELECT to_regclass('content_automation_audit_events') IS NOT NULL AND to_regclass('content_automation_notification_outbox') IS NOT NULL AS ready")).rows[0]?.ready;
  if(ready)break;
  await new Promise(resolve=>setTimeout(resolve,100));
}

async function insertSchedule(id,name){await pgQuery(`INSERT INTO content_automation_schedules(id,tenant_id,name,status,timezone,frequency,schedule_config_json,operator_request_json,next_run_at) VALUES($1,$2,$3,'paused','Asia/Jakarta','daily','{"hour":8,"minute":0}'::jsonb,'{}'::jsonb,CURRENT_TIMESTAMP+INTERVAL '1 day')`,[id,tenant,name]);}
async function insertRun(id,schedule,status,offset=0){await pgQuery(`INSERT INTO content_automation_runs(id,tenant_id,schedule_id,scheduled_for,idempotency_key,status,attempt_count,completed_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP+($6::text||' seconds')::interval,$4,$5,1,CASE WHEN $5=ANY(ARRAY['completed','failed','skipped']) THEN CURRENT_TIMESTAMP ELSE NULL END)`,[id,tenant,schedule,`test:${id}`,status,String(offset)]);}

try{
  await pgQuery(`INSERT INTO content_automation_notification_preferences(tenant_id,enabled,channel,chat_id,bot_token_ciphertext,events_json,timezone,updated_by) VALUES($1,TRUE,'telegram','test-chat','v1.fake.fake.fake','["failed"]'::jsonb,'Asia/Jakarta','tester')`,[tenant]);
  const event={tenantId:tenant,eventKey:`phase2b:${suffix}`,eventType:'failed',title:'Failed',message:'Test outbox',actionUrl:'/content-automations'};
  assert.ok(await enqueueExternalNotification(event));
  assert.equal(await enqueueExternalNotification(event),null);
  const notificationClaims=await Promise.all([claimNotification('notification-a',{tenantId:tenant}),claimNotification('notification-b',{tenantId:tenant})]);
  const claimedNotification=notificationClaims.find(Boolean);
  assert.equal(notificationClaims.filter(Boolean).length,1);
  assert.equal(claimedNotification.tenant_id,tenant);
  await markNotificationSent(claimedNotification.id,'test-message-42');
  assert.equal((await pgQuery('SELECT status FROM content_automation_notification_outbox WHERE id=$1',[claimedNotification.id])).rows[0].status,'sent');
  await pgQuery(`INSERT INTO content_automation_schedules(id,tenant_id,name,status,timezone,frequency,schedule_config_json,operator_request_json,missed_run_policy,grace_minutes,next_run_at) VALUES($1,$2,$3,'active','Asia/Jakarta','daily','{"hour":8,"minute":0}'::jsonb,'{}'::jsonb,'run_latest',60,CURRENT_TIMESTAMP-INTERVAL '2 days')`,[`${scheduleId}_claim`,tenant,'Phase 2 Claim Test']);
  const claims=await Promise.all([claimDueAutomation('test-a',{tenantId:tenant}),claimDueAutomation('test-b',{tenantId:tenant})]);
  assert.equal(claims.filter(item=>item?.run).length,1);
  assert.equal(Number((await pgQuery('SELECT COUNT(*) AS count FROM content_automation_runs WHERE tenant_id=$1 AND schedule_id=$2',[tenant,`${scheduleId}_claim`])).rows[0].count)>=1,true);
  await pgQuery("UPDATE content_automation_runs SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND schedule_id=$2",[tenant,`${scheduleId}_claim`]);
  await pgQuery("UPDATE content_automation_schedules SET status='paused' WHERE tenant_id=$1 AND id=$2",[tenant,`${scheduleId}_claim`]);
  await pgQuery("UPDATE content_automation_schedules SET status='active',auto_pause_threshold=1,consecutive_failure_count=0 WHERE tenant_id=$1 AND id=$2",[tenant,`${scheduleId}_claim`]);
  const paused=await recordScheduleOutcome(`${scheduleId}_claim`,false);
  assert.equal(paused.status,'paused');
  assert.equal(paused.just_auto_paused,true);
  await insertSchedule(scheduleId,'Phase 2 Purge Test');
  await insertRun(runFailed,scheduleId,'failed');
  await insertRun(runActive,scheduleId,'producing',1);
  await tenantContext.run(tenant,async()=>{
    const blocked=await previewSchedulePurge(scheduleId);
    assert.equal(blocked.blocker_count,1);
    await assert.rejects(()=>purgeSchedule(scheduleId,{actor:'tester',confirmationName:blocked.schedule_name,previewToken:blocked.preview_token}),/non-terminal/);
    await purgeRun(runFailed,{actor:'tester'});
    await assert.rejects(()=>purgeRun(runActive,{actor:'tester'}),/non-terminal/);
  });
  await pgQuery("UPDATE content_automation_runs SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=$1",[runActive]);
  await tenantContext.run(tenant,async()=>{
    const ready=await previewSchedulePurge(scheduleId);
    const result=await purgeSchedule(scheduleId,{actor:'tester',confirmationName:ready.schedule_name,previewToken:ready.preview_token});
    assert.equal(result.blocker_count,0);
  });

  await insertSchedule(schedule2,'Phase 2 Bulk Test');
  await insertRun(`car_${suffix}_one`,schedule2,'completed');
  await insertRun(`car_${suffix}_two`,schedule2,'skipped',1);
  await tenantContext.run(tenant,async()=>{
    const preview=await previewRunHistoryPurge({schedule_id:schedule2,statuses:['completed','skipped']});
    assert.equal(preview.run_count,2);
    const result=await purgeRunHistory(preview.filters,{actor:'tester',previewToken:preview.preview_token});
    assert.equal(result.deleted_count,2);
  });
  await pgQuery("UPDATE content_automation_schedules SET status='active',next_run_at=CURRENT_TIMESTAMP+INTERVAL '1 day' WHERE id=$1",[schedule2]);
  await tenantContext.run(tenant,async()=>{
    const from=new Date(),to=new Date(from.getTime()+7*86400000);
    const calendar=await getAutomationCalendar({from,to,timezone:'Asia/Jakarta'});
    assert.equal(calendar.events.some(event=>event.schedule_id===schedule2&&event.source==='schedule'),true);
    assert.equal(typeof calendar.health.dead_letter,'number');
    const filtered=await getAutomationCalendar({from,to,timezone:'Asia/Jakarta',scheduleId:schedule2,statuses:['scheduled']});
    assert.equal(filtered.events.every(event=>event.schedule_id===schedule2&&event.status==='scheduled'),true);
  });
  console.log('Content automation Phase 2A/2B/2C PostgreSQL integration tests passed.');
}finally{
  await pgQuery('DELETE FROM content_automation_notification_outbox WHERE tenant_id=$1',[tenant]).catch(()=>{});
  await pgQuery('DELETE FROM content_automation_notification_preferences WHERE tenant_id=$1',[tenant]).catch(()=>{});
  await pgQuery('DELETE FROM content_automation_schedules WHERE tenant_id=$1',[tenant]).catch(()=>{});
  await pgQuery('DELETE FROM content_automation_audit_events WHERE tenant_id=$1',[tenant]).catch(()=>{});
  const { getPgPool }=await import('../lib/db-pg.js');
  await getPgPool().end();
}
