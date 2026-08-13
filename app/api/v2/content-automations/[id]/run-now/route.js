import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAutomationAuditEvent,createRunNow,getAutomation,updateRun } from '@/lib/content-automation-repository';
import { createOperatorJobFromRequest } from '@/lib/operator-job-service';
import { calculateBackoff,classifyAutomationError,shouldRetry } from '@/lib/content-automation-retry';
import { applyProductSnapshotToOperatorRequest,captureProductSnapshot } from '@/lib/content-automation-product-snapshot';
import { assertProductCampaignEnabled } from '@/lib/content-automation-feature-flags';

export async function POST(request,{params}){
  let run,schedule;
  try{
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    const {id}=await params;
    schedule=await getAutomation(id);
    if(!schedule)return NextResponse.json({success:false,error:'Not found'},{status:404});
    if(schedule.campaign_kind==='product_campaign')await assertProductCampaignEnabled({execution:true,tenantId:user.tenantId});
    run=await createRunNow(schedule);
    let payload=typeof schedule.operator_request_json==='string'?JSON.parse(schedule.operator_request_json):schedule.operator_request_json;
    if((schedule.campaign_kind||payload?.planner?.planner_focus)==='product_campaign'){
      const snapshot=await captureProductSnapshot({brandProfileId:schedule.brand_profile_id||payload.planner.brand_id,productId:schedule.product_id||payload.planner.product_id,brandProductId:schedule.brand_product_id||payload.planner.brand_product_id});
      payload=applyProductSnapshotToOperatorRequest(payload,snapshot);
      await updateRun(run.id,{campaign_kind:'product_campaign',product_snapshot_json:JSON.stringify(snapshot)});
      await createAutomationAuditEvent({tenantId:user.tenantId,type:'product_snapshot_captured',scheduleId:schedule.id,runId:run.id,event:{product_id:snapshot.product_id,brand_product_id:snapshot.brand_product_id,sha256:snapshot.sha256}});
    }
    const job=await createOperatorJobFromRequest({request:payload,idempotencyKey:run.idempotency_key,actor:`automation-run-now:${user.id}`});
    await updateRun(run.id,{operator_job_id:job.id,status:'job_created'});
    return NextResponse.json({success:true,run_id:run.id,operator_job_id:job.id});
  }catch(e){
    let retryAt=null;
    if(run&&schedule){
      const policy=typeof schedule.retry_policy_json==='string'?JSON.parse(schedule.retry_policy_json):schedule.retry_policy_json||{};
      const failureClass=classifyAutomationError(e);
      if(shouldRetry({failureClass,attempt:run.attempt_count,maxAttempts:policy.max_attempts||3})){
        const delay=calculateBackoff({attempt:run.attempt_count,baseSeconds:policy.base_seconds||60,maxSeconds:policy.max_seconds||900});
        retryAt=new Date(Date.now()+delay*1000);
        await updateRun(run.id,{status:'retry_wait',failure_class:failureClass,error_code:e.code||'AUTOMATION_RUN_NOW_FAILED',error_message:e.message,next_attempt_at:retryAt});
      }else await updateRun(run.id,{status:'failed',failure_class:failureClass,error_code:e.code||'AUTOMATION_RUN_NOW_FAILED',error_message:e.message,completed_at:new Date()});
    }
    if(retryAt)return NextResponse.json({success:true,run_id:run.id,status:'retry_wait',retry_at:retryAt.toISOString(),message:'Dispatch sementara gagal dan akan dicoba ulang otomatis.'},{status:202});
    return NextResponse.json({success:false,code:e.code,error:e.message},{status:e.status||500});
  }
}
