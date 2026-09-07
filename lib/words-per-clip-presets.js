/**
 * Centralized Presets & Helper for Words Per Clip (Batasan Kata per Klip) & Video Models
 * Calibrated against video duration physics (Omni Flash 4s, 6s, 8s, 10s & Veo 3.1 Lite 8s)
 */

export const VIDEO_MODELS = [
  { value: 'veo_31_lite', label: 'Google Veo 3.1 Lite (Standar Cepat)', supports10s: false },
  { value: 'veo_31_fast', label: 'Google Veo 3.1 Fast', supports10s: false },
  { value: 'veo_31_quality', label: 'Google Veo 3.1 Quality (Kualitas Tinggi)', supports10s: false },
  { value: 'veo_31_lite_relaxed', label: 'Google Veo 3.1 Relaxed', supports10s: false },
  { value: 'omni_flash', label: '⚡ Google Veo Omni Flash (Support 4s/6s/8s/10s)', supports10s: true }
];

export const WORDS_PER_CLIP_CONFIG = {
  4: {
    default: '8-9 kata',
    options: [
      { value: '6-7 kata', label: '6-7 kata (Santai / Cinematic)' },
      { value: '8-9 kata', label: '8-9 kata (Standar UGC / Default)' },
      { value: '10-11 kata', label: '10-11 kata (Cepat / Punchy Hook)' }
    ]
  },
  6: {
    default: '12-14 kata',
    options: [
      { value: '10-11 kata', label: '10-11 kata (Santai / Cinematic)' },
      { value: '12-14 kata', label: '12-14 kata (Standar UGC / Default)' },
      { value: '15-16 kata', label: '15-16 kata (Cepat / Fast Promo)' }
    ]
  },
  8: {
    default: '17-19 kata',
    options: [
      { value: '15-16 kata', label: '15-16 kata (Santai / Cinematic)' },
      { value: '17-19 kata', label: '17-19 kata (Standar UGC / Default)' },
      { value: '20-22 kata', label: '20-22 kata (Cepat / Hard Sell)' }
    ]
  },
  10: {
    default: '22-24 kata',
    options: [
      { value: '18-20 kata', label: '18-20 kata (Santai / Cinematic)' },
      { value: '22-24 kata', label: '22-24 kata (Standar UGC / Default)' },
      { value: '25-28 kata', label: '25-28 kata (Cepat / Story Deep)' }
    ]
  }
};

export const ALL_WORDS_PER_CLIP_VALUES = [
  '6-7 kata', '8-9 kata', '10-11 kata',
  '12-14 kata', '15-16 kata', '17-19 kata',
  '18-20 kata', '20-22 kata', '20-24 kata',
  '22-24 kata', '25-28 kata'
];

export function getWordsPerClipOptions(duration = 8) {
  const dur = Number(duration) || 8;
  return WORDS_PER_CLIP_CONFIG[dur]?.options || WORDS_PER_CLIP_CONFIG[8].options;
}

export function getDefaultWordsPerClip(duration = 8) {
  const dur = Number(duration) || 8;
  return WORDS_PER_CLIP_CONFIG[dur]?.default || '17-19 kata';
}
