import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRun } from '@/lib/content-automation-repository';
import { getOperatorJob } from '@/lib/db';
import { buildOperatorReviewArtifact } from '@/lib/operator-review-artifact';

export const dynamic='force-dynamic';
export async function GET(request,{params}){try{const user=getCurrentUser(request);if(!user)return NextResponse.json({success:false,error:'Unauthorized'},{status:401});const {runId}=await params,run=await getRun(runId);if(!run||!run.operator_job_id)return NextResponse.json({success:false,error:'Run belum memiliki Operator job.'},{status:404});const job=await getOperatorJob(run.operator_job_id),review=await buildOperatorReviewArtifact(job);if(!review)return NextResponse.json({success:false,error:'Review belum tersedia.'},{status:409});return NextResponse.json({success:true,review:{revision:review.revision,sha256:review.sha256,item_count:review.item_count,clip_count:review.clip_count,start_frame_count:review.start_frame_count,product_snapshot:review.product_snapshot,item_summaries:review.item_summaries,markdown:review.markdown},campaign_id:job.campaign_id});}catch(e){return NextResponse.json({success:false,error:e.message},{status:e.status||500});}}
