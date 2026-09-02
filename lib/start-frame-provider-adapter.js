import { generateImage, getFileUrl, getTaskStatus } from './webhook-client.js';
import { buildOpcStartFrameRequest } from './opc-start-frame-request.js';
import { createStartFrameRequestAudit, updateStartFrameRequestAudit } from './opc-start-frame-audit.js';
import { requestImageLane, attachProviderTask, heartbeatImageLane, releaseImageLane } from './glabs-image-lane-service.js';
import { getDb } from './db.js';

export const startFrameProviderAdapter = {
  async submit(request) {
    let context = request?.context;
    if (context?.campaignId && context?.itemId && (!context.campaign || !context.item)) {
      const db = getDb();
      context = {
        ...context,
        campaign: await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(context.campaignId),
        item: await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(context.itemId)
      };
    }
    if (!context) {
      const error = new Error('OPC start-frame request wajib membawa canonical context.');
      error.code = 'START_FRAME_CONTEXT_REQUIRED';
      error.status = 422;
      throw error;
    }

    const built = await buildOpcStartFrameRequest(context);
    const auditId = request.auditId || (built.audit ? await createStartFrameRequestAudit({
      ...built.audit,
      lifecycle_status: 'prepared'
    }) : null);

    const requiresExclusive = Boolean(built.audit?.requires_product_reference);
    const laneMode = requiresExclusive ? 'exclusive' : 'shared';

    // Request provider lane
    const laneResult = await requestImageLane({
      tenantId: context.tenantId || context.campaign?.tenant_id,
      webhookOverride: built.providerRequest?.webhookOverride,
      mode: laneMode,
      ownerKind: 'start_frame_asset',
      ownerId: request.assetId || `asset_${Date.now()}`,
      campaignId: String(context.campaign?.id || context.campaignId || ''),
      campaignItemId: String(context.item?.id || context.itemId || ''),
      assetId: request.assetId || null,
      leaseSeconds: 180
    });

    const leaseId = laneResult.id || laneResult.lease?.id;
    const laneKey = laneResult.laneKey || laneResult.lease?.lane_key;

    if (!laneResult.acquired) {
      if (auditId) {
        await updateStartFrameRequestAudit(auditId, {
          lane_key: laneKey,
          lane_mode: laneMode,
          lane_wait_started_at: new Date()
        }).catch(() => {});
      }
      return {
        status: 'waiting_lane',
        leaseId,
        laneKey,
        laneMode
      };
    }

    // Lane acquired! Submit image generation to provider
    try {
      const result = await generateImage(built.providerRequest);
      if (!result?.task_id) {
        throw new Error('Provider tidak mengembalikan task_id.');
      }

      await attachProviderTask(leaseId, result.task_id);

      if (auditId) {
        await updateStartFrameRequestAudit(auditId, {
          provider_task_id: result.task_id,
          lane_key: laneKey,
          lane_mode: laneMode,
          lane_acquired_at: new Date(),
          lifecycle_status: 'submitted',
          provider_submitted_at: new Date()
        }).catch(() => {});
      }

      return {
        status: 'submitted',
        taskId: result.task_id,
        leaseId,
        laneKey,
        laneMode,
        auditId
      };
    } catch (err) {
      // If submit fails, immediately release lane lease so others aren't blocked
      await releaseImageLane(leaseId, `submit_failed:${err.message?.slice(0, 100)}`).catch(() => {});
      if (auditId) {
        await updateStartFrameRequestAudit(auditId, {
          lifecycle_status: 'failed'
        }).catch(() => {});
      }
      throw err;
    }
  },

  async poll(taskId, { leaseId = null } = {}) {
    if (leaseId) {
      await heartbeatImageLane(leaseId, { extendSeconds: 60 }).catch(() => {});
    }
    const result = await getTaskStatus(taskId);
    const status = String(result?.status || '').toLowerCase();
    if (status === 'failed') {
      if (leaseId) {
        await releaseImageLane(leaseId, 'provider_failed').catch(() => {});
      }
      return {
        status: 'failed',
        error: result.error || result.message || 'Provider task failed.'
      };
    }
    if (status !== 'completed') {
      return { status: 'pending' };
    }
    const files = result.results || result.files || [];
    let filename = files.find(file => /\.(png|jpe?g|webp)$/i.test(file)) || files[0];
    if (!filename) {
      if (leaseId) {
        await releaseImageLane(leaseId, 'no_image_file').catch(() => {});
      }
      return { status: 'failed', error: 'Provider selesai tanpa file gambar.' };
    }
    if (/^https?:\/\//.test(filename)) {
      filename = filename.split('/').pop();
    }
    return {
      status: 'completed',
      downloadUrl: getFileUrl(filename, taskId),
      files,
      filename
    };
  }
};
