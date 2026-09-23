import fs from 'fs';
import path from 'path';

/**
 * Resolves a web path (e.g. '/uploads/start_frames/foo.jpg') or system path to a valid absolute filesystem path.
 */
export function resolvePublicFilePath(filePath, baseCwd = process.cwd()) {
  if (!filePath || typeof filePath !== 'string') return null;
  const trimmed = filePath.trim();
  if (!trimmed) return null;

  // 1. If it's already an existing filesystem path (e.g. absolute or relative to cwd)
  if (fs.existsSync(trimmed)) {
    try {
      const stat = fs.statSync(trimmed);
      if (stat.isFile()) return path.resolve(trimmed);
    } catch (_) {}
  }

  // 2. Try resolving relative to public directory (stripping leading slashes)
  const cleanRelative = trimmed.replace(/^\/+/, '');
  const inPublic = path.join(baseCwd, 'public', cleanRelative);
  if (fs.existsSync(inPublic)) {
    try {
      const stat = fs.statSync(inPublic);
      if (stat.isFile()) return inPublic;
    } catch (_) {}
  }

  // 3. Try resolving directly from base cwd
  const directInCwd = path.join(baseCwd, cleanRelative);
  if (fs.existsSync(directInCwd)) {
    try {
      const stat = fs.statSync(directInCwd);
      if (stat.isFile()) return directInCwd;
    } catch (_) {}
  }

  return null;
}

/**
 * Searches for existing start frame image files in public/uploads/start_frames by clip index and item ID.
 * Matches both unrevisioned and revisioned files (*_clip_1.png, *_clip_1.jpg, *_clip_1_r*.jpg, etc.)
 */
export function findExistingStartFrameFile({ itemId, clipIndex, prefix = 'opc_start_frame', baseCwd = process.cwd() }) {
  const dir = path.join(baseCwd, 'public', 'uploads', 'start_frames');
  if (!fs.existsSync(dir)) return null;

  const targetPrefix = `${prefix}_${itemId}_clip_${clipIndex}`;
  try {
    const files = fs.readdirSync(dir);
    // Filter matching start frame image files
    const matched = files.filter(f => {
      if (!f.startsWith(targetPrefix)) return false;
      const remainder = f.slice(targetPrefix.length);
      // Remainder must be either .ext (e.g. .png/.jpg) or _r<num>_<hash>.<ext>
      const isDirectExt = remainder.startsWith('.') && (remainder.endsWith('.png') || remainder.endsWith('.jpg') || remainder.endsWith('.jpeg') || remainder.endsWith('.webp'));
      const isRevision = remainder.startsWith('_r') && (remainder.endsWith('.png') || remainder.endsWith('.jpg') || remainder.endsWith('.jpeg') || remainder.endsWith('.webp'));
      return isDirectExt || isRevision;
    });

    if (matched.length === 0) return null;

    // Sort to pick highest revision number (e.g. _r14_ over _r2_), then latest modification time
    matched.sort((a, b) => {
      const revA = parseInt((a.match(/_r(\d+)_/)?.[1] || '0'), 10);
      const revB = parseInt((b.match(/_r(\d+)_/)?.[1] || '0'), 10);
      if (revB !== revA) return revB - revA;

      try {
        const statA = fs.statSync(path.join(dir, a));
        const statB = fs.statSync(path.join(dir, b));
        return statB.mtimeMs - statA.mtimeMs;
      } catch (_) {
        return 0;
      }
    });

    const chosenFile = matched[0];
    const absolutePath = path.join(dir, chosenFile);
    const webRelativePath = `/uploads/start_frames/${chosenFile}`;
    return { absolutePath, webRelativePath };
  } catch (_) {
    return null;
  }
}
