import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { getUniverseManifest } from './universe-manifests.js';

export function fileToBase64(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  
  // Resolve absolute path
  let targetPath = null;
  if (path.isAbsolute(filePath)) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      targetPath = filePath;
    }
  } else {
    const candidates = [
      filePath,
      path.join(process.cwd(), 'public', filePath.startsWith('/') ? filePath.slice(1) : filePath),
      path.join(process.cwd(), filePath.startsWith('/') ? filePath.slice(1) : filePath)
    ];
    for (const p of candidates) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        targetPath = p;
        break;
      }
    }
  }

  if (!targetPath) return null;
  try {
    const fileBuffer = fs.readFileSync(targetPath);
    const extensionName = path.extname(targetPath).toLowerCase();
    let mimeType = 'image/png';
    if (extensionName === '.jpg' || extensionName === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (extensionName === '.webp') {
      mimeType = 'image/webp';
    } else if (extensionName === '.gif') {
      mimeType = 'image/gif';
    }
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  } catch (err) {
    console.error('[fileToBase64 Error]:', err.message);
    return null;
  }
}

/**
 * Downloads an image from HTTP or HTTPS and converts it to a base64 Data URL.
 */
export async function fetchUrlBase64(url) {
  if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) return null;
  return new Promise((resolve) => {
    const transport = url.startsWith('https') ? https : http;
    const req = transport.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        console.warn(`[fetchUrlBase64] Failed to fetch image: status ${res.statusCode} for ${url}`);
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (!buffer.length) {
          resolve(null);
          return;
        }
        let mime = 'image/png';
        const rawUrl = url.split('?')[0].toLowerCase();
        if (rawUrl.endsWith('.jpg') || rawUrl.endsWith('.jpeg')) mime = 'image/jpeg';
        else if (rawUrl.endsWith('.webp')) mime = 'image/webp';
        else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) mime = 'image/jpeg';
        else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) mime = 'image/png';
        else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) mime = 'image/webp';
        resolve(`data:${mime};base64,${buffer.toString('base64')}`);
      });
    });
    req.on('error', (err) => {
      console.warn(`[fetchUrlBase64 Error] ${err.message}`);
      resolve(null);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Universal resolver that handles both local file paths and remote URLs.
 */
export async function resolveImageToBase64(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
  if (pathOrUrl.startsWith('data:image/')) return pathOrUrl;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return await fetchUrlBase64(pathOrUrl);
  }
  return fileToBase64(pathOrUrl);
}

/**
 * Asynchronously resolves reference images (base64 strings) for cartoon character, product, and style locks
 */
export async function resolveClipReferenceImagesAsync({
  contentWorld,
  universeProfile,
  universeSnapshot,
  visualIdentitySnapshot,
  clip,
  productReference, // Can be base64, path, or url
  productRevealBeat, // e.g. "beat_4" or "beat_5"
  clipCharacters = [] // From storyboard JSON
}) {
  const result = {
    characterReferences: [],
    productReferences: [],
    styleReferences: [],
    allReferences: []
  };

  if (contentWorld !== 'cartoon_universe') {
    if (productReference) {
      const pBase64 = await resolveImageToBase64(productReference);
      if (pBase64) {
        result.productReferences.push(pBase64);
        result.allReferences.push(pBase64);
      }
    }
    return result;
  }

  // 1. Resolve Character references
  let manifest = universeSnapshot?.manifest;
  if (!manifest) {
    manifest = getUniverseManifest(universeProfile);
  }
  
  if (manifest && manifest.characters) {
    const resolvedCharKeys = new Set();
    clipCharacters.forEach(c => {
      const clean = c.trim().toLowerCase();
      if (manifest.characters[clean]) {
        resolvedCharKeys.add(clean);
      }
    });

    // Deduplicate and maintain stable sorting
    const sortedCharKeys = Array.from(resolvedCharKeys).sort();
    console.log(`[CharacterLock Async] Clip ${clip}: characters=${sortedCharKeys.join(',')} refs=${sortedCharKeys.length}`);

    for (const key of sortedCharKeys) {
      const char = manifest.characters[key];
      const imagePath = char.identity_reference_path || char.reference_image_path;
      const b64 = await resolveImageToBase64(imagePath);
      if (b64) {
        result.characterReferences.push(b64);
      } else {
        console.warn(`[CharacterLock Warning] Reference image not found for character ${key} at: ${imagePath}`);
      }
    }
  }

  // 2. Resolve Product references
  const revealBeatNum = productRevealBeat === 'beat_5' ? 5 : (productRevealBeat === 'beat_4' ? 4 : 99);
  const isProductVisible = Number(clip) >= revealBeatNum;
  
  if (isProductVisible && productReference) {
    const pBase64 = await resolveImageToBase64(productReference);
    if (pBase64) {
      result.productReferences.push(pBase64);
    }
  }

  // 3. Style Reference
  let stylePath = manifest?.style_reference_path;
  if (visualIdentitySnapshot?.reference_assets) {
    const viStyle = visualIdentitySnapshot.reference_assets.find(
      a => a.owner_type === 'visual_identity' && a.role === 'visual_style'
    );
    if (viStyle?.public_path) {
      stylePath = viStyle.public_path;
    }
  }

  if (stylePath) {
    const b64 = await resolveImageToBase64(stylePath);
    if (b64) {
      result.styleReferences.push(b64);
    }
  }

  // 4. Combine and deduplicate all references
  const allSet = new Set([
    ...result.characterReferences,
    ...result.productReferences,
    ...result.styleReferences
  ]);
  result.allReferences = Array.from(allSet);

  return result;
}

/**
 * Synchronous resolver (preserved for backward compatibility with synchronous callers)
 */
export function resolveClipReferenceImages({
  contentWorld,
  universeProfile,
  universeSnapshot,
  visualIdentitySnapshot,
  clip,
  productReference, // Can be base64 or path
  productRevealBeat, // e.g. "beat_4" or "beat_5"
  clipCharacters = [] // From storyboard JSON
}) {
  const result = {
    characterReferences: [],
    productReferences: [],
    styleReferences: [],
    allReferences: []
  };

  if (contentWorld !== 'cartoon_universe') {
    if (productReference) {
      const pBase64 = productReference.startsWith('data:') ? productReference : fileToBase64(productReference);
      if (pBase64) {
        result.productReferences.push(pBase64);
        result.allReferences.push(pBase64);
      }
    }
    return result;
  }

  // 1. Resolve Character references
  let manifest = universeSnapshot?.manifest;
  if (!manifest) {
    manifest = getUniverseManifest(universeProfile);
  }
  
  if (manifest && manifest.characters) {
    const resolvedCharKeys = new Set();
    clipCharacters.forEach(c => {
      const clean = c.trim().toLowerCase();
      // Only resolve character if present in manifest characters list
      if (manifest.characters[clean]) {
        resolvedCharKeys.add(clean);
      }
    });

    // Deduplicate and maintain stable sorting
    const sortedCharKeys = Array.from(resolvedCharKeys).sort();
    
    // Log resolution path safely (no base64 or sensitive data)
    console.log(`[CharacterLock] Clip ${clip}: characters=${sortedCharKeys.join(',')} refs=${sortedCharKeys.length}`);

    for (const key of sortedCharKeys) {
      const char = manifest.characters[key];
      const imagePath = char.identity_reference_path || char.reference_image_path;
      const b64 = fileToBase64(imagePath);
      if (b64) {
        result.characterReferences.push(b64);
      } else {
        console.warn(`[CharacterLock Warning] Reference image not found for character ${key} at: ${imagePath}`);
      }
    }
  }

  // 2. Resolve Product references
  // Only visible on or after reveal beat
  const revealBeatNum = productRevealBeat === 'beat_5' ? 5 : (productRevealBeat === 'beat_4' ? 4 : 99);
  const isProductVisible = Number(clip) >= revealBeatNum;
  
  if (isProductVisible && productReference) {
    const pBase64 = productReference.startsWith('data:') ? productReference : fileToBase64(productReference);
    if (pBase64) {
      result.productReferences.push(pBase64);
    }
  }

  // 3. Style Reference
  let stylePath = manifest?.style_reference_path;
  if (visualIdentitySnapshot?.reference_assets) {
    const viStyle = visualIdentitySnapshot.reference_assets.find(
      a => a.owner_type === 'visual_identity' && a.role === 'visual_style'
    );
    if (viStyle?.public_path) {
      stylePath = viStyle.public_path;
    }
  }

  if (stylePath) {
    const b64 = fileToBase64(stylePath);
    if (b64) {
      result.styleReferences.push(b64);
    }
  }

  // 4. Combine and deduplicate all references
  const allSet = new Set([
    ...result.characterReferences,
    ...result.productReferences,
    ...result.styleReferences
  ]);
  result.allReferences = Array.from(allSet);

  return result;
}
