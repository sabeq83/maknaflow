import path from 'path';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

export function validateProductAssetEntryName(entryName) {
  if (typeof entryName !== 'string' || entryName.includes('\0')) {
    throw new Error('ZIP berisi nama file tidak valid.');
  }
  const normalized = entryName.replace(/\\/g, '/');
  if (!normalized.startsWith('assets/')) return null;
  const relative = normalized.slice('assets/'.length);
  if (!relative || path.posix.isAbsolute(relative) || relative.split('/').includes('..')) {
    throw new Error(`Path aset ZIP tidak aman: ${entryName}`);
  }
  if (!IMAGE_EXTENSIONS.has(path.extname(relative).toLowerCase())) {
    throw new Error(`Ekstensi aset tidak diizinkan: ${entryName}`);
  }
  return relative;
}

export function normalizeImportedProductImagePath(value) {
  if (!value || /^https?:\/\//i.test(value)) return value;
  const relative = String(value).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!relative || path.posix.isAbsolute(relative) || relative.split('/').includes('..') || relative.includes('\0')) {
    throw new Error(`Path gambar produk tidak aman: ${value}`);
  }
  return `/${relative}`;
}
