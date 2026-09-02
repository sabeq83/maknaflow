import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Detect image file extension from buffer magic bytes
 */
export function detectImageExtension(buffer, fallback = 'png') {
  if (!buffer || buffer.length < 4) return fallback;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'webp';
  }
  return fallback;
}

/**
 * Detect MIME type from buffer magic bytes
 */
export function detectImageMimeType(buffer, fallback = 'image/png') {
  const ext = detectImageExtension(buffer, null);
  if (ext === 'jpg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return fallback;
}

/**
 * Build immutable revisioned filename for start frames.
 * Pattern: opc_start_frame_<itemId>_clip_<clipIndex>_r<revision>_<providerTaskId>.<ext>
 */
export function buildRevisionedStartFrameFilename({
  itemId,
  clipIndex,
  revision = 1,
  providerTaskId = null,
  extension = 'png'
}) {
  const cleanItemId = String(itemId).replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanClipIndex = Number(clipIndex) || 1;
  const cleanRevision = Math.max(1, Number(revision) || 1);
  const cleanTaskId = providerTaskId ? String(providerTaskId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) : 'init';
  const cleanExt = String(extension).replace(/^\./, '').toLowerCase() || 'png';

  return `opc_start_frame_${cleanItemId}_clip_${cleanClipIndex}_r${cleanRevision}_${cleanTaskId}.${cleanExt}`;
}

/**
 * Save image buffer to revisioned start frame path atomically
 */
export async function saveRevisionedStartFrame({
  itemId,
  clipIndex,
  revision = 1,
  providerTaskId = null,
  buffer,
  directory = null
}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Buffer gambar wajib disediakan.');
  }

  const extension = detectImageExtension(buffer, 'png');
  const mimeType = detectImageMimeType(buffer, 'image/png');
  const filename = buildRevisionedStartFrameFilename({
    itemId,
    clipIndex,
    revision,
    providerTaskId,
    extension
  });

  const targetDir = directory || path.join(process.cwd(), 'public', 'uploads', 'start_frames');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const absolutePath = path.join(targetDir, filename);
  const tempPath = `${absolutePath}.tmp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  fs.writeFileSync(tempPath, buffer);
  fs.renameSync(tempPath, absolutePath);

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    filename,
    relativePath: `/uploads/start_frames/${filename}`,
    absolutePath,
    checksum,
    byteLength: buffer.length,
    mimeType,
    extension
  };
}
