import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import sharp from 'sharp';
import { getActiveTenantId } from './tenant-context.js';

const ALLOWED_MIMES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp'
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function validateMagicBytes(buffer) {
  if (buffer.length < 4) throw new Error('File is too small to verify magic bytes.');
  
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  // WEBP (RIFF .... WEBP)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'image/webp';
    }
  }
  
  throw new Error('Unsupported image format (magic bytes validation failed). Only PNG, JPEG, and WEBP are allowed.');
}

function sanitizeSegment(val) {
  return String(val).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

export function resolveManagedReferencePath(asset) {
  const tenant = sanitizeSegment(asset.tenant_id || getActiveTenantId());
  const ownerType = sanitizeSegment(asset.owner_type);
  const ownerId = sanitizeSegment(asset.owner_id);
  const role = sanitizeSegment(asset.asset_role);
  const version = `v${asset.version}`;
  
  const checksumPrefix = asset.sha256 ? asset.sha256.substring(0, 16) : 'unknown';
  const ext = ALLOWED_MIMES[asset.mime_type] || '.jpg';
  const fileName = `${checksumPrefix}${ext}`;

  const relDir = path.join('uploads', 'reference-assets', tenant, ownerType, ownerId, role, version);
  const absDir = path.join(process.cwd(), 'public', relDir);
  
  return {
    relPath: '/' + path.join(relDir, fileName).replace(/\\/g, '/'),
    absPath: path.join(absDir, fileName)
  };
}

async function writeFileAtomically(destPath, buffer) {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${destPath}.tmp_${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, destPath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
    throw err;
  }
}

export async function processImageBuffer(buffer, assetDraft) {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds the 10 MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`);
  }

  const mime = validateMagicBytes(buffer);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // Load width & height using sharp
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width;
  const height = metadata.height;

  // Resolve path
  const targetAsset = {
    ...assetDraft,
    mime_type: mime,
    sha256
  };
  const paths = resolveManagedReferencePath(targetAsset);

  // Write atomically
  await writeFileAtomically(paths.absPath, buffer);

  return {
    storage_path: paths.absPath,
    public_path: paths.relPath,
    mime_type: mime,
    byte_size: buffer.length,
    sha256,
    width,
    height
  };
}

export async function ingestUploadedReference(fileBuffer, assetDraft) {
  return await processImageBuffer(fileBuffer, assetDraft);
}

// Simple safety check against SSRF
function isUrlSafe(urlString) {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    
    // Block localhost / private IP ranges
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.')
    ) {
      return false;
    }
    if (host.startsWith('172.')) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return false;
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}

export async function ingestProviderReference(url, assetDraft) {
  if (!isUrlSafe(url)) {
    throw new Error('Ingestion blocked: Provider URL is not in a safe public scope (SSRF Protection).');
  }

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const req = protocol.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`Failed to download provider image: HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      let totalSize = 0;

      res.on('data', (chunk) => {
        totalSize += chunk.length;
        if (totalSize > MAX_FILE_SIZE) {
          req.destroy();
          reject(new Error('Ingestion failed: Downloaded file exceeds 10 MB limit.'));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const result = await processImageBuffer(buffer, assetDraft);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ingestion timed out while downloading reference image.'));
    });

    req.on('error', (err) => {
      reject(new Error(`Ingestion download network error: ${err.message}`));
    });
  });
}

export async function verifyManagedReference(asset) {
  if (!asset.storage_path) return false;
  try {
    if (!fs.existsSync(asset.storage_path)) return false;
    
    // Check checksum
    const buffer = fs.readFileSync(asset.storage_path);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    return sha256 === asset.sha256;
  } catch (_) {
    return false;
  }
}
