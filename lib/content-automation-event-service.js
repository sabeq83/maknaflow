import { pgQuery } from './db-pg.js';
import { createNotification } from './content-automation-repository.js';
import { enqueueExternalNotification } from './notification-outbox-repository.js';
import { automationEventKey } from './content-automation-events.js';

export async function emitCampaignItemEvent({ tenantId, campaignId, itemId, revision, eventType, title, message, actionUrl }) {
  const run = (await pgQuery(`SELECT r.* FROM content_automation_runs r
    JOIN operator_jobs o ON o.id=r.operator_job_id
    WHERE r.tenant_id=$1 AND o.campaign_id=$2 ORDER BY r.created_at DESC LIMIT 1`, [tenantId, String(campaignId)])).rows[0];
  if (!run) return { skipped: true, reason: 'automation_run_not_found' };
  await createNotification(run, eventType, title, message, actionUrl);
  await enqueueExternalNotification({
    tenantId,
    runId: run.id,
    scheduleId: run.schedule_id,
    eventKey: automationEventKey({ tenantId, runId: run.id, itemId, event: eventType, revision }),
    eventType,
    title,
    message,
    actionUrl
  });
  return { emitted: true, runId: run.id };
}
