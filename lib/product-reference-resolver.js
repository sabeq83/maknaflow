import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const ACTIVE_PHOTO_FIELDS = Object.freeze(['clean_photo_url','cleaned_photo_url','generated_photo_url','raw_photo_url','photo_url']);

function photoCandidates(product, fallbackPaths = []) {
  const active = ACTIVE_PHOTO_FIELDS.includes(product?.active_photo) ? product[product.active_photo] : null;
  return [active, product?.clean_photo_url, product?.cleaned_photo_url, product?.generated_photo_url, product?.raw_photo_url, product?.photo_url, ...fallbackPaths]
    .filter((value, index, values) => typeof value === 'string' && value.trim() && values.indexOf(value) === index);
}

function campaignPhotoCandidates(product, fallbackPaths = []) {
  return [product?.clean_photo_url, product?.cleaned_photo_url, product?.photo_url, product?.raw_photo_url, ...fallbackPaths]
    .filter((value, index, values) => typeof value === 'string' && value.trim() && values.indexOf(value) === index);
}

export function resolveActiveProductPhotoPath(product, fallbackPaths = []) {
  return photoCandidates(product, fallbackPaths)[0] || null;
}

function unwrapProductImageUrl(value) {
  if (!value?.includes('/api/v2/products/image?path=')) return value;
  try { return new URL(value, 'http://local').searchParams.get('path') || value; } catch { return value; }
}

export function resolveLocalProductImagePath(value, { cwd = process.cwd() } = {}) {
  const clean = unwrapProductImageUrl(value);
  if (!clean || /^https?:\/\//i.test(clean)) return null;
  const publicRoot = path.resolve(cwd, 'public');
  const candidates = path.isAbsolute(clean)
    ? [path.resolve(clean), path.resolve(publicRoot, clean.replace(/^\/+/, ''))]
    : [path.resolve(publicRoot, clean), path.resolve(cwd, clean)];
  return candidates.find(candidate => candidate.startsWith(`${publicRoot}${path.sep}`) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function resolveProductReferenceFromCandidates({ product, candidates, cwd }) {
  let selectedPath = null, absolutePath = null;
  for (const candidate of candidates) {
    const resolved = resolveLocalProductImagePath(candidate, { cwd });
    if (resolved) { selectedPath = candidate; absolutePath = resolved; break; }
  }
  if (!absolutePath) return null;
  const buffer = fs.readFileSync(absolutePath);
  let mimeType = 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) mimeType = 'image/jpeg';
  else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) mimeType = 'image/webp';
  else if (!(buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)) return null;
  const activeField = ACTIVE_PHOTO_FIELDS.includes(product?.active_photo) && product[product.active_photo] === selectedPath ? product.active_photo : ACTIVE_PHOTO_FIELDS.find(field => product?.[field] === selectedPath) || 'fallback';
  return { path: selectedPath, absolutePath, mimeType, base64DataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`, sourceField: activeField, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), exists: true };
}

export function resolveActiveProductReference({ product, fallbackPaths = [], cwd = process.cwd() }) {
  return resolveProductReferenceFromCandidates({ product, candidates:photoCandidates(product, fallbackPaths), cwd });
}

export function resolveCampaignProductReference({ product, fallbackPaths = [], cwd = process.cwd() }) {
  return resolveProductReferenceFromCandidates({ product, candidates:campaignPhotoCandidates(product, fallbackPaths), cwd });
}
