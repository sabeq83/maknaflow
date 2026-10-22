import { pgQuery } from './db-pg.js';
import { tenantContext } from './tenant-context.js';
export async function resumeApprovedStudioPublishing(tenantId, slotId = null) {
  const pending = (await pgQuery(`SELECT t.*,s.contentflow_id,s.output_media_type,s.title,s.final_caption,s.final_media_url,s.timezone
    FROM content_studio_targets t JOIN content_studio_slots s ON s.id=t.slot_id AND s.tenant_id=t.tenant_id
    JOIN content_studio_batches b ON b.id=s.batch_id AND b.tenant_id=s.tenant_id
    WHERE t.tenant_id=$1 AND ($2::text IS NULL OR t.slot_id=$2) AND t.status='scheduling' AND t.publishing_job_id IS NULL
      AND t.approved_at IS NOT NULL AND t.approval_revision=s.revision_hash AND s.stage_status='ready' AND b.engine_kind IS NOT NULL
    ORDER BY t.approved_at LIMIT 10`, [tenantId, slotId])).rows;
  if (!pending.length) return;
  const { schedulePublishingJobs } = await import('./publishing-service.js');
  for (const t of pending) {
    const result = await tenantContext.run(tenantId, () => schedulePublishingJobs({tenantId,userId:t.approved_by,rawBody:{content_id:t.contentflow_id,account_ids:[t.account_id],publish_mode:'live',media_type:t.output_media_type==='image'?'image':'video',title:t.title,caption:t.final_caption,media_url:t.final_media_url,scheduled_at:new Date(t.scheduled_at).toISOString(),timezone:t.timezone,is_ai_generated:true}}));
    const job=result.data?.[0];
    if(!job?.id)throw Error('Publishing service tidak mengembalikan job.');
    await pgQuery("UPDATE content_studio_targets SET publishing_job_id=$3,status='scheduled',error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2 AND publishing_job_id IS NULL", [t.id,tenantId,job.id]);
  }
}
