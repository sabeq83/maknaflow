/**
 * Centralized Audio-Video Synchronization & FFmpeg Presets Hub
 * File: lib/sync-constants.js
 * Single Source of Truth untuk opsi sinkronisasi video-audio FFmpeg dan target kecepatan kata (Words Per Clip).
 */

export const FFMPEG_SYNC_PRESETS = [
  {
    id: 'smart_sync',
    label: '⚡ Smart Dynamic Sync (Rekomendasi)',
    desc: 'Prioritaskan video penuh. Jika audio lebih panjang, time-stretch halus tanpa distorsi nada.'
  },
  {
    id: 'shortest',
    label: '✂️ Truncate to Shortest',
    desc: 'Memotong aset yang lebih panjang tepat saat aset terpendek selesai.'
  },
  {
    id: 'loop_video',
    label: '🔁 Loop Video',
    desc: 'Mengulang video secara mulus (crossfade loop) hingga narasi suara selesai.'
  },
  {
    id: 'freeze_frame',
    label: '⏸️ Freeze Final Frame',
    desc: 'Menahan frame terakhir video hingga voiceover selesai berbicara.'
  },
  {
    id: 'speed_adjust',
    label: '⏩ Speed Adjust Video',
    desc: 'Menyesuaikan kecepatan putar video otomatis agar durasi sama persis dengan audio.'
  }
];

export const WORDS_PER_CLIP_PRESETS = [
  { id: '12-14 kata', label: '12-14 kata (Slow / Tenang / ASMR)' },
  { id: '15-17 kata', label: '15-17 kata (Standard Natural / Rekomendasi)' },
  { id: '18-20 kata', label: '18-20 kata (Fast / Upbeat / Padat)' }
];

export const SYNC_MODES = [
  { id: 'auto', label: 'Otomatis (Smart Heuristic)' },
  { id: 'pad_silence', label: 'Pad Silence (Tambah Jeda Senyap)' },
  { id: 'trim_audio', label: 'Trim Audio (Potong Audio Lebih)' },
  { id: 'loop_video', label: 'Loop Video' }
];
