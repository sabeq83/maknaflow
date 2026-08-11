import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function detectImageMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp';
  return null;
}

export function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function saveRawProductImage({ tenantId, productId, buffer, originalName }) {
  const mimeType = detectImageMime(buffer);
  if (!mimeType) throw new Error('Invalid image format');
  
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  const tenantSafeId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '');
  const productSafeId = String(productId).replace(/[^a-zA-Z0-9_-]/g, '');
  const timestamp = Date.now();
  
  const fileName = `raw_${tenantSafeId}_${productSafeId}_${timestamp}.${ext}`;
  const dirPath = path.join(process.cwd(), 'public', 'uploads', 'products', tenantSafeId, 'raw');
  
  await fs.promises.mkdir(dirPath, { recursive: true });
  
  const absolutePath = path.join(dirPath, fileName);
  await fs.promises.writeFile(absolutePath, buffer);
  
  const relativePath = `/uploads/products/${tenantSafeId}/raw/${fileName}`;
  const sha256 = sha256Hex(buffer);
  
  return { relativePath, absolutePath, sha256, mimeType, sizeBytes: buffer.length };
}

export async function saveCleanProductImage({ tenantId, productId, buffer, mimeType }) {
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  const tenantSafeId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '');
  const productSafeId = String(productId).replace(/[^a-zA-Z0-9_-]/g, '');
  const timestamp = Date.now();
  
  const fileName = `clean_${tenantSafeId}_${productSafeId}_${timestamp}.${ext}`;
  const dirPath = path.join(process.cwd(), 'public', 'uploads', 'products', tenantSafeId, 'clean');
  
  await fs.promises.mkdir(dirPath, { recursive: true });
  
  const absolutePath = path.join(dirPath, fileName);
  await fs.promises.writeFile(absolutePath, buffer);
  
  const relativePath = `/uploads/products/${tenantSafeId}/clean/${fileName}`;
  const sha256 = sha256Hex(buffer);
  
  return { relativePath, absolutePath, sha256, sizeBytes: buffer.length };
}

export function safeDeleteFile(absolutePath) {
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (e) {
    // Ignore error
  }
}

export function readLocalImageToBuffer(relativePath) {
  if (!relativePath) return null;
  // Ensure it doesn't try to read outside public directory
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const absolutePath = path.join(process.cwd(), 'public', cleanPath);
  
  // Basic security check
  if (!absolutePath.startsWith(path.join(process.cwd(), 'public'))) return null;
  
  try {
    if (fs.existsSync(absolutePath)) {
      return fs.readFileSync(absolutePath);
    }
  } catch (e) {
    // Ignore
  }
  return null;
}
