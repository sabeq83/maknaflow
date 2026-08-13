import { generateImage, getFileUrl, getTaskStatus } from './webhook-client.js';

export const startFrameProviderAdapter = {
  async submit(request) {
    const result = await generateImage(request);
    if (!result?.task_id) throw new Error('Provider tidak mengembalikan task_id.');
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
