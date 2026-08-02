import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRun, prepareRunRetry, updateRun } from '@/lib/content-automation-repository';
import { createOperatorJobFromRequest } from '@/lib/operator-job-service';

export async function POST(request,{params}) {
  try {
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    const {runId}=await params, current=await getRun(runId);
    if(!current)return NextResponse.json({success:false,error:'Run tidak ditemukan.'},{status:404});
    if(current.status!=='failed')return NextResponse.json({success:false,error:'Hanya run gagal yang dapat di-retry.'},{status:409});
    const run=await prepareRunRetry(runId);
    const payload=typeof current.operator_request_json==='string'?JSON.parse(current.operator_request_json):current.operator_request_json;
    try {
      const job=await createOperatorJobFromRequest({request:payload,idempotencyKey:run.idempotency_key,actor:`automation-retry:${user.id}`});
      await updateRun(run.id,{operator_job_id:job.id,status:'job_created'});
      return NextResponse.json({success:true,run_id:run.id,operator_job_id:job.id,attempt_count:run.attempt_count});
    } catch(error) {
      await updateRun(run.id,{status:'failed',error_code:error.code||'AUTOMATION_RETRY_FAILED',error_message:error.message,completed_at:new Date()});
      throw error;
    }
  } catch(error) {
    return NextResponse.json({success:false,code:error.code,error:error.message},{status:error.status||500});
  }
}
