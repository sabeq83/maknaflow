import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRun } from '@/lib/content-automation-repository';
import { getDb, getOperatorJob } from '@/lib/db';
import { syncApprovedOpcItemToContentFlow } from '@/lib/content-automation-contentflow';

export async function POST(request,{params}) {
  try {
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    const {runId}=await params,run=await getRun(runId);
    if(!run?.operator_job_id)return NextResponse.json({success:false,error:'Run tidak ditemukan.'},{status:404});
    const job=await getOperatorJob(run.operator_job_id),db=getDb();
    const items=await db.prepare("SELECT id FROM pillar_campaign_items WHERE campaign_id=? AND approved_revision IS NOT NULL AND contentflow_sync_status IN('pending','retry_wait','failed') ORDER BY id").all(job.campaign_id);
    const synced=[],failed=[];
    for(const item of items){try{await syncApprovedOpcItemToContentFlow({itemId:item.id});synced.push(item.id);}catch(error){failed.push({id:item.id,error:error.message});}}
    return NextResponse.json({success:failed.length===0,synced,failed});
  }catch(error){return NextResponse.json({success:false,error:error.message},{status:error.status||500});}
}
