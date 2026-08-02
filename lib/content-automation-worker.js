import os from 'os';
import { tenantContext } from './tenant-context.js';
import { calculateNextRun } from './content-automation-schedule.js';
import { createOperatorJobFromRequest } from './operator-job-service.js';
import { advanceSchedule, claimDueAutomation, createNotification, listRunsToReconcile, updateRun } from './content-automation-repository.js';

const state=globalThis.__contentAutomationWorker || {interval:null,running:false,lastTick:null,lastError:null}; globalThis.__contentAutomationWorker=state;
async function dispatch(claim){const {schedule,run,reused}=claim; const config=typeof schedule.schedule_config_json==='string'?JSON.parse(schedule.schedule_config_json):schedule.schedule_config_json; try{
  if(reused&&run.status!=='dispatching')return;
  const request=typeof schedule.operator_request_json==='string'?JSON.parse(schedule.operator_request_json):schedule.operator_request_json;
  const job=await tenantContext.run(schedule.tenant_id,()=>createOperatorJobFromRequest({request,idempotencyKey:run.idempotency_key,actor:`automation:${schedule.id}`}));
  await updateRun(run.id,{operator_job_id:job.id,status:'job_created'});
}catch(error){await updateRun(run.id,{status:'failed',error_code:error.code||'AUTOMATION_DISPATCH_FAILED',error_message:error.message,completed_at:new Date()}); state.lastError=error.message;
}finally{await advanceSchedule(schedule,calculateNextRun({frequency:schedule.frequency,config,timezone:schedule.timezone,after:new Date(schedule.next_run_at)}));}}
async function reconcile(){for(const run of await listRunsToReconcile()){if(!run.operator_status)continue; let status=run.status;
  if(run.operator_status==='awaiting_approval')status='awaiting_approval'; else if(run.operator_status==='producing'||run.operator_status==='campaign_queued')status='producing'; else if(run.operator_status==='completed')status='completed'; else if(run.operator_status==='failed')status='failed';
  if(status!==run.status){await updateRun(run.id,{status,...(['completed','failed'].includes(status)?{completed_at:new Date()}: {})}); if(status==='awaiting_approval')await createNotification(run,'awaiting_approval',`${run.schedule_name} siap direview`,'Storyboard telah siap. Buka review dan setujui revision yang sesuai.',`/content-automations?run=${run.id}`);}}
}
export async function runContentAutomationTick(){if(state.running)return;state.running=true;state.lastTick=new Date().toISOString();try{const claim=await claimDueAutomation(`${os.hostname()}:${process.pid}`);if(claim)await tenantContext.run(claim.schedule.tenant_id,()=>dispatch(claim));await reconcile();}catch(e){state.lastError=e.message;console.error('[Content Automation Worker]',e.message);}finally{state.running=false;}}
export function startContentAutomationWorker(){if(state.interval)return state.interval;const ms=Math.max(5000,Number(process.env.CONTENT_AUTOMATION_INTERVAL_MS||15000));runContentAutomationTick();state.interval=setInterval(runContentAutomationTick,ms);console.log(`⏱️ Content Automation Worker started (${ms}ms).`);return state.interval;}
export function getContentAutomationRuntime(){return {...state,running:Boolean(state.interval)};}
