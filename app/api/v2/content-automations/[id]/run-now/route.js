import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createRunNow,getAutomation,updateRun } from '@/lib/content-automation-repository';
import { createOperatorJobFromRequest } from '@/lib/operator-job-service';
import { calculateBackoff,classifyAutomationError,shouldRetry } from '@/lib/content-automation-retry';

export async function POST(request,{params}){
  let run,schedule;
  try{
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    const {id}=await params;
    schedule=await getAutomation(id);
    if(!schedule)return NextResponse.json({success:false,error:'Not found'},{status:404});
    run=await createRunNow(schedule);
    const payload=typeof schedule.operator_request_json==='string'?JSON.parse(schedule.operator_request_json):schedule.operator_request_json;
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
