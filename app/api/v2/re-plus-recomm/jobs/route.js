import { NextResponse } from 'next/server';
import { getDb, createRecommJob, listRecommJobs, createJob } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const jobs = await listRecommJobs();
    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    console.error('[API recomm jobs GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { campaign_name, source_urls, target_recommendations_count } = await request.json();

    if (!campaign_name) {
      return NextResponse.json({ success: false, error: 'Campaign name is required' }, { status: 400 });
    }

    if (!source_urls || !Array.isArray(source_urls) || source_urls.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one source URL is required' }, { status: 400 });
    }

    const jobId = `job_${uuidv4()}`;
    const sourceUrlsJson = JSON.stringify(source_urls);

    // Save job in DB
    await createRecommJob({
      id: jobId,
      campaign_name,
      source_urls_json: sourceUrlsJson,
      target_recommendations_count: target_recommendations_count || 3
    });

    // Enqueue background worker task
    await createJob('re_plus_recomm', { job_id: jobId });

    return NextResponse.json({ success: true, job_id: jobId });
  } catch (error) {
    console.error('[API recomm jobs POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
