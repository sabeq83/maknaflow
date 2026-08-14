import crypto from 'crypto';

const DATA_URI_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i;

function detectMimeType(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp';
  return null;
}

export function inspectBase64ImageReference(reference) {
  const match = typeof reference === 'string' ? reference.match(DATA_URI_PATTERN) : null;
  if (!match) throw Object.assign(new Error('Format reference image T2I tidak valid.'), { code:'INVALID_IMAGE_REFERENCE' });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw Object.assign(new Error('Reference image T2I kosong.'), { code:'EMPTY_IMAGE_REFERENCE' });
  const declaredMimeType = `image/${match[1].toLowerCase()}`;
  const detectedMimeType = detectMimeType(buffer);
  if (!detectedMimeType || detectedMimeType !== declaredMimeType) {
    throw Object.assign(new Error('MIME reference image tidak sesuai magic bytes.'), { code:'IMAGE_REFERENCE_MIME_MISMATCH' });
  }
  return {
    mimeType: detectedMimeType,
    byteLength: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

export function inspectBase64ImageReferences(references = []) {
  if (!Array.isArray(references)) throw Object.assign(new Error('reference_images harus berupa array.'), { code:'INVALID_IMAGE_REFERENCE' });
  return references.map(inspectBase64ImageReference);
}
