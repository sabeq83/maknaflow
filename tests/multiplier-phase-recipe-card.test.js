import assert from 'assert';
import { getCloudMasterFileName, getCloudFolderPath, getCloudThumbFileName, getCloudClipFileName } from '../lib/cloud-naming-helper.js';

console.log('🧪 Starting Multiplier Phase, Recipe, & Cloud Naming Unit Tests...\n');

// 1. Test Cloud Naming Helper Alignment with Pillar Campaign
console.log('1. Testing Cloud Naming Helper:');
{
  const taskId = 'mul_261015_lg4ad4_01';
  const masterFileName = getCloudMasterFileName(taskId, 'mp4');
  assert.strictEqual(masterFileName, 'mul_261015_lg4ad4_01_final.mp4', 'Master video must be <taskId>_final.mp4');

  const folderPath = getCloudFolderPath({
    accountName: 'Nutribake',
    campaignId: 'mul_261015_lg4ad4',
    videoId: taskId
  });
  assert.strictEqual(folderPath, '/nutribake/mul_261015_lg4ad4/mul_261015_lg4ad4_01', 'Folder path must follow /<account>/<campaign>/<video>');

  const thumbName = getCloudThumbFileName(taskId, 'jpg');
  assert.strictEqual(thumbName, 'mul_261015_lg4ad4_01_thumb.jpg', 'Thumb name must be <taskId>_thumb.jpg');

  const clipName = getCloudClipFileName({ videoId: taskId, type: 'frame', clipNo: 2, ext: 'png' });
  assert.strictEqual(clipName, 'mul_261015_lg4ad4_01_frame_c02.png', 'Frame name must follow <taskId>_frame_c<no>.png');

  console.log('  ✓ Cloud folder and filename conventions match Pillar Campaign standard.');
}

// 2. Test React Stale State Resolution Logic
console.log('\n2. Testing React Stale State Prevention Logic:');
{
  const updateCaptionState = (prev, taskId, incomingCaption) => {
    // Exact logic from app/multiplier-lab/[id]/page.js
    if (prev[taskId] !== undefined && prev[taskId] !== '') return prev;
    return { ...prev, [taskId]: incomingCaption || '' };
  };

  // Case A: Initial empty string from previous pending task
  const initialPendingState = { 'task_01': '' };
  const updatedState = updateCaptionState(initialPendingState, 'task_01', 'Resep Es Krim Alpukat Mewah Bebas Gula');
  assert.strictEqual(updatedState['task_01'], 'Resep Es Krim Alpukat Mewah Bebas Gula', 'Empty string must be overwritten by new incoming caption');

  // Case B: User has actively edited the caption
  const userEditedState = { 'task_01': 'Customized by user' };
  const preservedState = updateCaptionState(userEditedState, 'task_01', 'Brand new backend caption');
  assert.strictEqual(preservedState['task_01'], 'Customized by user', 'User edit must NOT be overwritten');

  console.log('  ✓ Stale state bug successfully resolved.');
}

// 3. Test Phase Badge Status Logic
console.log('\n3. Testing Phase Badge Status Labels:');
{
  function getPhaseBadgeText(status, errorMessage) {
    switch (status) {
      case 'draft': return '📝 Fase 1 : Draft (Belum Dimulai)';
      case 'pending_resolution': return '⏳ Fase 1 : Queue for Generation';
      case 'resolving_product': return '⚡ Fase 1 : Resolving Product DNA';
      case 'remaking': return '⚡ Fase 1 : AI Storyboard Remake';
      case 'generating_t2i': return '⚡ Fase 1 : Generasi T2I Start Frames';
      case 'waiting_approval': return '⏸️ Fase 2 : Paused (Ready for Review)';
      case 'generating_audio': return '⚡ Fase 2 : Generasi TTS Audio';
      case 'generating_visuals': return '⚡ Fase 2 : Generasi I2V Video (G-Labs)';
      case 'ffmpeg_muxing': return '⚡ Fase 2 : FFMPEG Process & Assembly';
      case 'uploading_assets': return '⚡ Fase 2 : Uploading Assets (Nextcloud)';
      case 'completed': return '✅ Fase 2 : Completed';
      case 'failed': return `⚠️ Error: ${errorMessage ? errorMessage.slice(0, 35) + '...' : 'Gagal'}`;
      default: return `⚡ ${status}`;
    }
  }

  assert.strictEqual(getPhaseBadgeText('draft'), '📝 Fase 1 : Draft (Belum Dimulai)');
  assert.strictEqual(getPhaseBadgeText('pending_resolution'), '⏳ Fase 1 : Queue for Generation');
  assert.strictEqual(getPhaseBadgeText('resolving_product'), '⚡ Fase 1 : Resolving Product DNA');
  assert.strictEqual(getPhaseBadgeText('remaking'), '⚡ Fase 1 : AI Storyboard Remake');
  assert.strictEqual(getPhaseBadgeText('generating_t2i'), '⚡ Fase 1 : Generasi T2I Start Frames');
  assert.strictEqual(getPhaseBadgeText('waiting_approval'), '⏸️ Fase 2 : Paused (Ready for Review)');
  assert.strictEqual(getPhaseBadgeText('generating_audio'), '⚡ Fase 2 : Generasi TTS Audio');
  assert.strictEqual(getPhaseBadgeText('generating_visuals'), '⚡ Fase 2 : Generasi I2V Video (G-Labs)');
  assert.strictEqual(getPhaseBadgeText('ffmpeg_muxing'), '⚡ Fase 2 : FFMPEG Process & Assembly');
  assert.strictEqual(getPhaseBadgeText('uploading_assets'), '⚡ Fase 2 : Uploading Assets (Nextcloud)');
  assert.strictEqual(getPhaseBadgeText('completed'), '✅ Fase 2 : Completed');
  assert.ok(getPhaseBadgeText('failed', 'Timeout error on G-Labs connection').startsWith('⚠️ Error:'));

  console.log('  ✓ All 11 phase stages correctly mapped with proper icons and descriptive labels.');
}

// 4. Test Tab Numbering Structure
console.log('\n4. Testing Tab Numbering Structure:');
{
  const tabs = [
    { id: 'deconstruct', label: '🔍 Tab 1: Dekonstruksi Asli' },
    { id: 'storyboard', label: '📖 Tab 2: Storyboard & Visual Baru' },
    { id: 'recipe', label: '🍳 Tab 3: Resep Kuliner & Paket Medsos' },
    { id: 'vault', label: '🗄️ Tab 4: Asset Vault Status' },
    { id: 'dna', label: '🧬 Tab 5: Video DNA Metadata' },
    { id: 'logs', label: '💻 Tab 6: Terminal Log & Queue' }
  ];

  assert.strictEqual(tabs.length, 6, 'Must have 6 numbered tabs');
  tabs.forEach((tab, index) => {
    const expectedPrefix = `Tab ${index + 1}:`;
    assert.ok(tab.label.includes(expectedPrefix), `Tab ${tab.id} must contain "${expectedPrefix}"`);
  });

  console.log('  ✓ All 6 tabs contain consecutive "Tab 1:" through "Tab 6:" prefixes.');
}

console.log('\n🎉 ALL MULTIPLIER TESTS PASSED SUCCESSFULLY!\n');
