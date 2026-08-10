import fs from 'fs';
import path from 'path';
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
 * Resolves reference images (base64 strings) for cartoon character, product, and style locks
 */
export function resolveClipReferenceImages({
  contentWorld,
  universeProfile,
  universeSnapshot,
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
      const b64 = fileToBase64(char.identity_reference_path);
      if (b64) {
        result.characterReferences.push(b64);
      } else {
        console.warn(`[CharacterLock Warning] Reference image not found for character ${key} at: ${char.identity_reference_path}`);
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

  // 3. Style Reference (PawVille style anchor)
  if (manifest?.style_reference_path) {
    const b64 = fileToBase64(manifest.style_reference_path);
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
