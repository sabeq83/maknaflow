import crypto from 'crypto';

const DATA_URI_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i;

function detectMimeType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'image/webp';
    }
    return 'image/webp';
  }
  return null;
}

export function getReferenceData(reference) {
  if (typeof reference === 'string') return reference;
  if (reference && typeof reference === 'object' && typeof reference.data === 'string') return reference.data;
  return null;
}

export function sanitizeReferenceName(rawName, mimeType) {
  if (!rawName || typeof rawName !== 'string') return null;
  const basename = rawName.replace(/^.*[\\\/]/, '').trim();
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
  const ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/webp' ? '.webp' : '.png';
  if (!sanitized.toLowerCase().endsWith(ext) && !sanitized.toLowerCase().endsWith('.jpeg')) {
    return `${sanitized.replace(/\.[^.]+$/, '')}${ext}`;
  }
  return sanitized;
}

export function inspectBase64ImageReference(reference) {
  const data = getReferenceData(reference);
  const match = typeof data === 'string' ? data.match(DATA_URI_PATTERN) : null;
  if (!match) throw Object.assign(new Error('Format reference image T2I tidak valid.'), { code: 'INVALID_IMAGE_REFERENCE' });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length < 100) {
    throw Object.assign(new Error('Reference image T2I kosong atau di bawah ukuran minimum G-Labs (100 bytes).'), { code: 'EMPTY_IMAGE_REFERENCE' });
  }
  const rawDeclared = match[1].toLowerCase();
  const declaredMimeType = `image/${rawDeclared === 'jpg' ? 'jpeg' : rawDeclared}`;
  const detectedMimeType = detectMimeType(buffer);
  if (!detectedMimeType || detectedMimeType !== declaredMimeType) {
    throw Object.assign(new Error('MIME reference image tidak sesuai magic bytes.'), { code: 'IMAGE_REFERENCE_MIME_MISMATCH' });
  }

  let sanitizedName = null;
  let category = null;
  if (reference && typeof reference === 'object') {
    const rawName = reference.name || reference.filename;
    if (rawName) sanitizedName = sanitizeReferenceName(rawName, detectedMimeType);
    if (reference.category && typeof reference.category === 'string') {
      category = reference.category.trim().toLowerCase();
    }
  }

  return {
    mimeType: detectedMimeType,
    byteLength: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    name: sanitizedName,
    category,
    isObject: typeof reference === 'object'
  };
}

export function inspectBase64ImageReferences(references = []) {
  if (!Array.isArray(references)) throw Object.assign(new Error('reference_images harus berupa array.'), { code: 'INVALID_IMAGE_REFERENCE' });
  return references.map(inspectBase64ImageReference);
}
