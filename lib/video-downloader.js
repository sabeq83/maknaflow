import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

import { getSetting } from './db.js';

// Ensure local bin directory is added to PATH so system can find yt-dlp, ffmpeg, ffprobe
const localBin = path.join(process.cwd(), 'bin');
if (!process.env.PATH.includes(localBin)) {
  process.env.PATH = `${process.env.PATH}${path.delimiter}${localBin}`;
}

const execFileAsync = promisify(execFile);

const TEMP_DIR = path.join(process.cwd(), 'data', 'temp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Check if yt-dlp is available in the system
 */
export async function checkYtDlp() {
  try {
    await execFileAsync('yt-dlp', ['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function downloadFromUrl(url) {
  const available = await checkYtDlp();
  if (!available) {
    throw new Error('yt-dlp tidak tersedia. Install dengan: brew install yt-dlp. Atau gunakan fitur Upload File.');
  }

  const outputTemplate = path.join(TEMP_DIR, '%(id)s.%(ext)s');
  const cookiePath = path.join(process.cwd(), 'data', 'fb_cookies.txt');
  const hasCookies = fs.existsSync(cookiePath);

  const runYtDlp = async (withCookies, useBrowserCookiesFallback = false) => {
    const baseArgs = ['-f', 'best[ext=mp4]/best', '--no-playlist'];
    
    let cookiesApplied = false;
    if (withCookies && hasCookies) {
      baseArgs.push('--cookies', cookiePath);
      cookiesApplied = true;
    }
    
    if (!cookiesApplied && useBrowserCookiesFallback) {
      const browser = getSetting('ytdlp_cookies_from_browser');
      if (browser && browser !== 'none') {
        baseArgs.push('--cookies-from-browser', browser);
      }
    }
    
    baseArgs.push('-o', outputTemplate, url);

    // First, get the filename
    const { stdout: infoOut } = await execFileAsync('yt-dlp', [
      '--print', 'filename',
      ...baseArgs
    ], { timeout: 120000 });

    const expectedFile = infoOut.trim();

    // Download the video
    await execFileAsync('yt-dlp', [
      ...baseArgs,
      '--no-warnings'
    ], { timeout: 300000 }); // 5 min timeout

    return expectedFile;
  };

  try {
    const attempts = [];
    if (hasCookies) {
      attempts.push({ name: 'static cookies', useStatic: true, useBrowser: false });
    }
    const browser = getSetting('ytdlp_cookies_from_browser');
    if (browser && browser !== 'none') {
      attempts.push({ name: `browser cookies (${browser})`, useStatic: false, useBrowser: true });
    }
    attempts.push({ name: 'no cookies', useStatic: false, useBrowser: false });

    let expectedFile;
    let lastError;

    for (const attempt of attempts) {
      try {
        expectedFile = await runYtDlp(attempt.useStatic, attempt.useBrowser);
        break; // Success!
      } catch (error) {
        lastError = error;
        console.warn(`[yt-dlp] Download with ${attempt.name} failed: ${error.message}. Trying next fallback...`);
      }
    }

    if (!expectedFile) {
      throw lastError || new Error('Download failed after trying all fallback methods');
    }

    // Find the downloaded file
    const filePath = expectedFile;
    if (!fs.existsSync(filePath)) {
      // Fallback: find most recent file in temp dir
      const files = fs.readdirSync(TEMP_DIR)
        .map(f => ({ name: f, time: fs.statSync(path.join(TEMP_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);
      
      if (files.length === 0) throw new Error('Download gagal — file tidak ditemukan');
      
      return {
        filePath: path.join(TEMP_DIR, files[0].name),
        filename: files[0].name,
        mimeType: getMimeType(files[0].name),
      };
    }

    return {
      filePath,
      filename: path.basename(filePath),
      mimeType: getMimeType(filePath),
    };
  } catch (error) {
    if (error.message.includes('yt-dlp')) throw error;
    throw new Error(`Download gagal: ${error.stderr || error.message}. Coba gunakan Upload File.`);
  }
}

/**
 * Clean up temp file
 */
export function cleanupTempFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch { /* ignore cleanup errors */ }
}

export function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.m4v': 'video/mp4',
    '.mp3': 'audio/mp3',
    '.wav': 'audio/wav',
    '.m4a': 'audio/m4a',
    '.mpeg': 'audio/mpeg',
  };
  return mimeMap[ext] || 'video/mp4';
}


// ========================
// V3: Video Library Helpers
// ========================
const LIBRARY_DIR = path.join(process.cwd(), 'data', 'video_library');
const THUMBNAIL_DIR = path.join(process.cwd(), 'data', 'thumbnails');

export function ensureLibraryDir() {
  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  if (!fs.existsSync(THUMBNAIL_DIR)) fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

/**
 * Move a file from temp (or any path) to the permanent video library.
 * Returns the new path inside /data/video_library/.
 */
export function moveToLibrary(sourcePath, targetFilename) {
  ensureLibraryDir();
  const targetPath = path.join(LIBRARY_DIR, targetFilename);
  fs.copyFileSync(sourcePath, targetPath);
  // Remove source only if it's in the temp dir
  if (sourcePath.includes(path.join('data', 'temp'))) {
    try { fs.unlinkSync(sourcePath); } catch { /* ignore */ }
  }
  return targetPath;
}

/**
 * Generate a thumbnail from a video file using ffmpeg.
 * Captures frame at 1 second mark.
 * Returns the thumbnail path or null on failure.
 */
export async function generateThumbnail(videoPath, thumbnailFilename) {
  ensureLibraryDir();
  const ext = path.extname(videoPath).toLowerCase();
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'];
  if (audioExtensions.includes(ext)) {
    console.log(`[Thumbnail] Skipping thumbnail generation for audio-only file: ${videoPath}`);
    return null;
  }
  const outputPath = path.join(THUMBNAIL_DIR, thumbnailFilename);
  try {
    await execFileAsync('ffmpeg', [
      '-i', videoPath,
      '-ss', '00:00:01',
      '-vframes', '1',
      '-vf', 'scale=320:-1',
      '-y',
      outputPath,
    ], { timeout: 30000 });
    return fs.existsSync(outputPath) ? outputPath : null;
  } catch (err) {
    console.warn('[Thumbnail] ffmpeg failed:', err.message);
    return null;
  }
}

/**
 * Get file size in bytes
 */
export function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch { return 0; }
}

/**
 * Delete a file from the library
 */
export function deleteLibraryFile(localPath) {
  try {
    if (localPath && fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch { /* ignore */ }
}

export { LIBRARY_DIR, THUMBNAIL_DIR };
