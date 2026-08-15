import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveFfprobePath } from '../lib/ffprobe-path.js';

function accessFor(validPaths) {
  const valid = new Set(validPaths);
  return candidate => {
    if (!valid.has(candidate)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  };
}

test('FFprobe resolver memprioritaskan FFPROBE_PATH yang valid', () => {
  const configured = '/custom/bin/ffprobe';
  assert.equal(resolveFfprobePath({
    envPath: configured,
    accessSync: accessFor([configured])
  }), configured);
});

test('FFprobe resolver gagal eksplisit jika FFPROBE_PATH invalid', () => {
  assert.throws(() => resolveFfprobePath({
    envPath: '/missing/ffprobe',
    accessSync: accessFor([])
  }), /FFPROBE_PATH tidak ditemukan atau tidak executable/);
});

test('FFprobe resolver memilih Homebrew arm64 pada Mac Mini', () => {
  const homebrew = '/opt/homebrew/bin/ffprobe';
  assert.equal(resolveFfprobePath({
    envPath: '',
    platform: 'darwin',
    arch: 'arm64',
    accessSync: accessFor([homebrew])
  }), homebrew);
});

test('FFprobe resolver fallback ke ffprobe-static dalam node_modules', () => {
  const cwd = '/srv/maknaflow';
  const packaged = path.join(cwd, 'node_modules', 'ffprobe-static', 'bin', 'linux', 'x64', 'ffprobe');
  assert.equal(resolveFfprobePath({
    envPath: '',
    platform: 'linux',
    arch: 'x64',
    cwd,
    staticPath: '/missing/.next/server/chunks/bin/linux/x64/ffprobe',
    accessSync: accessFor([packaged])
  }), packaged);
});

test('FFprobe resolver tidak memilih path bundle Next.js yang hilang', () => {
  assert.throws(() => resolveFfprobePath({
    envPath: '',
    platform: 'darwin',
    arch: 'arm64',
    cwd: '/Users/masbenu/maknaflow-staging',
    staticPath: '/Users/masbenu/maknaflow-staging/.next/server/chunks/bin/darwin/arm64/ffprobe',
    accessSync: accessFor([])
  }), /FFprobe binary tidak ditemukan/);
});

test('FFprobe resolver menormalisasi path virtual ROOT jika executable tersedia', () => {
  const cwd = '/srv/maknaflow';
  const normalized = path.join(cwd, 'node_modules/ffprobe-static/bin/linux/x64/ffprobe');
  assert.equal(resolveFfprobePath({
    envPath: '',
    platform: 'linux',
    arch: 'x64',
    cwd,
    staticPath: '/ROOT/node_modules/ffprobe-static/bin/linux/x64/ffprobe',
    accessSync: accessFor([normalized])
  }), normalized);
});
