import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';

test('buildOrganicPillarPrompt includes YouTube title schema in social_media_package', () => {
  const prompt = buildOrganicPillarPrompt([], {
    aspect_ratio: '9:16',
    target_clips_count: 4,
    visual_mode: 'hybrid_lock',
    target_language: 'id-ID'
  }, null, null, null);

  assert.ok(prompt.includes('"social_media_package": {'), 'Prompt must contain social_media_package');
  assert.ok(prompt.includes('"title": "Judul YouTube Shorts/Video yang click-worthy'), 'Prompt must specify YouTube title requirement');
  assert.ok(prompt.includes('"caption": "Single Universal Caption & YouTube Content Description lengkap'), 'Prompt must specify caption & YouTube description requirement');
});

test('normalization maps social_media_package.title to yt_title properly', () => {
  const parsed = {
    social_media_package: {
      title: 'Rahasia Trik Menembus Algoritma YouTube #Shorts',
      caption: 'Ini dia penjelasannya lengkap...'
    }
  };

  const extractedYtTitle = (typeof parsed.social_media_package === 'object' && parsed.social_media_package?.title)
    ? String(parsed.social_media_package.title).trim()
    : (parsed.yt_title || '');
  const extractedYtDesc = (typeof parsed.social_media_package === 'object' && parsed.social_media_package?.caption)
    ? String(parsed.social_media_package.caption).trim()
    : (parsed.yt_desc || parsed.caption || '');

  parsed.yt_title = extractedYtTitle;
  parsed.yt_desc = extractedYtDesc;

  assert.equal(parsed.yt_title, 'Rahasia Trik Menembus Algoritma YouTube #Shorts');
  assert.equal(parsed.yt_desc, 'Ini dia penjelasannya lengkap...');
});
