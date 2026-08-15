import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveFfprobePath } from './ffprobe-path.js';

const execFileAsync = promisify(execFile);

function parseRate(value) {
  if (!value) return 0;
  const [numerator, denominator = '1'] = String(value).split('/').map(Number);
  return denominator ? numerator / denominator : 0;
}

export function validateFacebookReelProbe(probe) {
  const errors = [];
  const warnings = [];
  if (!probe) return { errors: ['Metadata video tidak dapat dibaca.'], warnings };
  if (!['h264', 'hevc', 'h265', 'vp9', 'av1'].includes(probe.codec)) errors.push(`Codec video '${probe.codec || 'unknown'}' tidak didukung Facebook Reels.`);
  if (probe.audioCodec && probe.audioCodec !== 'aac') errors.push(`Codec audio '${probe.audioCodec}' bukan AAC.`);
  if (probe.width < 540 || probe.height < 960) errors.push(`Resolusi ${probe.width}x${probe.height} di bawah minimum Facebook Reels 540x960.`);
  if (probe.duration < 3 || probe.duration > 90) errors.push(`Durasi ${probe.duration.toFixed(1)} detik di luar batas Facebook Reels 3–90 detik.`);
  if (probe.frameRate < 24 || probe.frameRate > 60) errors.push(`Frame rate ${probe.frameRate.toFixed(2)} fps di luar batas Facebook Reels 24–60 fps.`);
  const ratio = probe.width && probe.height ? probe.width / probe.height : 0;
  if (ratio < (9 / 16) - 0.01 || ratio > (16 / 9) + 0.01) errors.push(`Aspect ratio ${probe.width}:${probe.height} tidak didukung Facebook Reels.`);
  else if (Math.abs(ratio - (9 / 16)) > 0.02) warnings.push('Video bukan rasio vertikal 9:16 yang direkomendasikan untuk distribusi Reels.');
  if (probe.width < 1080 || probe.height < 1920) warnings.push('Resolusi di bawah rekomendasi Facebook Reels 1080x1920.');
  return { errors, warnings };
}

export async function probePublishingMedia(mediaUrl, timeoutMs = 15000) {
  const url = new URL(mediaUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Media harus memakai URL HTTP/HTTPS.');
  const { stdout } = await execFileAsync(resolveFfprobePath(), [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels',
    '-of', 'json',
    mediaUrl
  ], { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  const video = (parsed.streams || []).find(stream => stream.codec_type === 'video') || {};
  const audio = (parsed.streams || []).find(stream => stream.codec_type === 'audio') || {};
  return {
    codec: String(video.codec_name || '').toLowerCase(),
    audioCodec: String(audio.codec_name || '').toLowerCase() || null,
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    duration: Number(parsed.format?.duration || 0),
    frameRate: parseRate(video.r_frame_rate),
    audioSampleRate: Number(audio.sample_rate || 0),
    audioChannels: Number(audio.channels || 0)
  };
}
