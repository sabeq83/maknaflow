import { generateImage, getFileUrl, getTaskStatus } from './webhook-client.js';
import { buildOpcStartFrameRequest } from './opc-start-frame-request.js';
import { recordStartFrameRequestAudit } from './opc-start-frame-audit.js';
import { getDb } from './db.js';

export const startFrameProviderAdapter = {
  async submit(request) {
    let context = request?.context;
    if (context?.campaignId && context?.itemId && (!context.campaign || !context.item)) {
      const db = getDb();
      context = { ...context, campaign:await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(context.campaignId), item:await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(context.itemId) };
    }
    const built = context ? await buildOpcStartFrameRequest(context) : { providerRequest: request, audit: request?.audit || null };
    const result = await generateImage(built.providerRequest);
    if (!result?.task_id) throw new Error('Provider tidak mengembalikan task_id.');
    if (built.audit) await recordStartFrameRequestAudit(built.audit, result.task_id);
    return { taskId: result.task_id };
  },
  async poll(taskId) {
    const result = await getTaskStatus(taskId);
    const status = String(result?.status || '').toLowerCase();
    if (status === 'failed') return { status: 'failed', error: result.error || result.message || 'Provider task failed.' };
    if (status !== 'completed') return { status: 'pending' };
    const files = result.results || result.files || [];
    let filename = files.find(file => /\.(png|jpe?g)$/i.test(file)) || files[0];
    if (!filename) return { status: 'failed', error: 'Provider selesai tanpa file gambar.' };
    if (/^https?:\/\//.test(filename)) filename = filename.split('/').pop();
    return { status: 'completed', downloadUrl: getFileUrl(filename, taskId) };
  }
};
