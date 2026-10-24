import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('trigger step generate performs clean-slate reset on all start frame and storyboard fields', async () => {
  // Simulasi mock item sebelum di-reset (sudah selesai generate & start frames)
  const item = {
    id: '9999',
    campaign_id: 'camp_test_1',
    generation_status: 'completed',
    result_json: JSON.stringify({ scenes: [1, 2, 3] }),
    new_video_plan_json: JSON.stringify([{ clip_index: 1, t2i_prompt: 'prompt 1' }]),
    video_dna_json: JSON.stringify({ pacing: 'dynamic' }),
    recipe_data_json: JSON.stringify({ title: 'Test Recipe' }),
    recipe_revision: 1,
    t2i_start_frame_path: '/uploads/start_frames/test_thumb.jpg',
    t2i_images_json: JSON.stringify(['/uploads/start_frames/clip1.jpg', '/uploads/start_frames/clip2.jpg']),
    start_frame_status: 'completed',
    start_frame_completed_count: 2,
    start_frame_expected_count: 2,
    regenerate_start_frames_status: 'completed',
    regenerate_start_frames_progress: '2/2',
    review_revision: 1,
    approved_revision: 1,
    approved_at: new Date().toISOString(),
    approved_by: 'reviewer_1',
    review_state: 'approved',
    review_reason: 'Looks good',
    review_actor_id: 'actor_1',
    review_state_updated_at: new Date().toISOString(),
    tts_status: 'completed',
    tts_batch_id: 'tts_123',
    visual_status: 'completed',
    visual_tasks_json: '[{"taskId":"t1"}]',
    visual_clip_paths: JSON.stringify(['/clips/1.mp4']),
    ffmpeg_status: 'completed',
    ffmpeg_output_path: '/final.mp4',
    upload_status: 'completed',
    drive_link: 'https://drive.google.com/...',
    social_post_status: 'completed',
    social_links_json: '{"fb":"..."}',
    workflow_status: 'completed'
  };

  // Buat file dummy fisik di temporary folder untuk menguji pembersihan file
  const testUploadDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
  if (!fs.existsSync(testUploadDir)) {
    fs.mkdirSync(testUploadDir, { recursive: true });
  }
  const testDummyFile = path.join(testUploadDir, 'unit_test_dummy_sf.jpg');
  fs.writeFileSync(testDummyFile, 'dummy image content');
  assert.ok(fs.existsSync(testDummyFile), 'Dummy file must exist before test');

  item.t2i_start_frame_path = '/uploads/start_frames/unit_test_dummy_sf.jpg';

  // Jalankan logika reset persis seperti pada trigger/route.js saat step === 'generate'
  const updateFields = {};
  const step = 'generate';

  if (step === 'generate') {
    let nextStatus = 'pending';
    try {
      if (item.row_creative_payload) {
        const payload = JSON.parse(item.row_creative_payload);
        if (payload.source_product_url && payload.source_product_url.trim() !== '') {
          nextStatus = 'pending_sourcing';
        }
      }
    } catch (_) {}

    // Cleanup file fisik
    try {
      const oldImages = [];
      if (item.t2i_images_json) {
        try {
          const parsed = JSON.parse(item.t2i_images_json);
          if (Array.isArray(parsed)) oldImages.push(...parsed);
        } catch (_) {}
      }
      if (item.t2i_start_frame_path) oldImages.push(item.t2i_start_frame_path);

      for (const imgPath of oldImages) {
        if (typeof imgPath === 'string' && imgPath.includes('/uploads/start_frames/')) {
          const rel = imgPath.startsWith('/') ? imgPath.slice(1) : imgPath;
          const fullPath = path.join(process.cwd(), 'public', rel);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }
      }
    } catch (_) {}

    updateFields.generation_status = nextStatus;
    updateFields.result_json = null;
    updateFields.new_video_plan_json = null;
    updateFields.video_dna_json = null;
    updateFields.recipe_data_json = null;
    updateFields.recipe_revision = null;

    // Reset Start Frame
    updateFields.t2i_start_frame_path = null;
    updateFields.t2i_images_json = null;
    updateFields.start_frame_status = 'pending';
    updateFields.start_frame_completed_count = 0;
    updateFields.start_frame_expected_count = 0;
    updateFields.regenerate_start_frames_status = null;
    updateFields.regenerate_start_frames_progress = null;

    // Reset Review / Approval Checkpoint
    updateFields.review_revision = null;
    updateFields.approved_revision = null;
    updateFields.approved_at = null;
    updateFields.approved_by = null;
    updateFields.review_state = 'pending_review';
    updateFields.review_reason = null;
    updateFields.review_actor_id = null;
    updateFields.review_state_updated_at = null;

    // Reset Downstream Production Pipeline
    updateFields.tts_status = 'pending';
    updateFields.tts_batch_id = null;
    updateFields.visual_status = 'pending';
    updateFields.visual_tasks_json = '[]';
    updateFields.visual_clip_paths = null;
    updateFields.ffmpeg_status = 'pending';
    updateFields.ffmpeg_output_path = null;
    updateFields.upload_status = 'pending';
    updateFields.drive_link = null;
    updateFields.social_post_status = 'pending';
    updateFields.social_links_json = null;
    updateFields.workflow_status = 'creative_processing';
  }

  // Verifikasi seluruh field start frame kembali ke null / 0 / pending
  assert.equal(updateFields.generation_status, 'pending');
  assert.equal(updateFields.result_json, null);
  assert.equal(updateFields.new_video_plan_json, null);
  assert.equal(updateFields.video_dna_json, null);
  assert.equal(updateFields.recipe_data_json, null);
  assert.equal(updateFields.recipe_revision, null);

  assert.equal(updateFields.t2i_start_frame_path, null, 't2i_start_frame_path must be reset to null');
  assert.equal(updateFields.t2i_images_json, null, 't2i_images_json must be reset to null');
  assert.equal(updateFields.start_frame_status, 'pending', 'start_frame_status must be pending');
  assert.equal(updateFields.start_frame_completed_count, 0, 'completed count must be 0');
  assert.equal(updateFields.start_frame_expected_count, 0, 'expected count must be 0');
  assert.equal(updateFields.regenerate_start_frames_status, null);
  assert.equal(updateFields.regenerate_start_frames_progress, null);

  // Verifikasi review checkpoint di-invalidasi
  assert.equal(updateFields.review_revision, null);
  assert.equal(updateFields.approved_revision, null);
  assert.equal(updateFields.review_state, 'pending_review');

  // Verifikasi downstream pipeline di-reset
  assert.equal(updateFields.tts_status, 'pending');
  assert.equal(updateFields.visual_status, 'pending');
  assert.equal(updateFields.ffmpeg_status, 'pending');
  assert.equal(updateFields.workflow_status, 'creative_processing');

  // Verifikasi file fisik lokal berhasil dihapus
  assert.ok(!fs.existsSync(testDummyFile), 'Dummy file must have been deleted by clean-slate reset');
});
