import fs from 'node:fs';
import path from 'node:path';
import ffprobe from 'ffprobe-static';

function normalizeBundledPath(candidate, cwd) {
  if (!candidate) return null;
  if (candidate.startsWith('/ROOT/')) return path.join(cwd, candidate.slice(6));
  if (candidate.startsWith('/ROOT')) return path.join(cwd, candidate.slice(5));
  return candidate;
}

function isExecutable(candidate, accessSync) {
  try {
    accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveFfprobePath({
  envPath = process.env.FFPROBE_PATH,
  platform = process.platform,
  arch = process.arch,
  cwd = process.cwd(),
  staticPath = ffprobe.path,
  accessSync = fs.accessSync
} = {}) {
  if (envPath) {
    if (isExecutable(envPath, accessSync)) return envPath;
    throw new Error(`FFPROBE_PATH tidak ditemukan atau tidak executable: ${envPath}`);
  }

  const executable = platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  const candidates = [
    platform === 'darwin' && arch === 'arm64' ? '/opt/homebrew/bin/ffprobe' : null,
    path.join(cwd, 'node_modules', 'ffprobe-static', 'bin', platform, arch, executable),
    normalizeBundledPath(staticPath, cwd)
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];
  const resolved = uniqueCandidates.find(candidate => isExecutable(candidate, accessSync));
  if (resolved) return resolved;

  throw new Error(`FFprobe binary tidak ditemukan. Lokasi yang diperiksa: ${uniqueCandidates.join(', ')}`);
}

