export const reSections = ['Sumber, Mode & Preset', 'Basic Creative Strategy', 'Aesthetics & Visual Settings', 'Product Bridging Settings', 'Visual Identity', 'Workflow & Audio Settings'];
export const flag = value => value === true || value === 1 || value === '1' || value === 'true';
export function normalizeReDraft(payload) {
  const result = { ...payload };
  for (const key of ['is_bridging_active','enable_vo_audit','enable_audio_segment','generate_recipe','enable_tts','enable_glabs','enable_ffmpeg','enable_social_post','post_youtube_draft','post_tiktok_draft','post_facebook_draft','local_scheduler']) {
    if (key in result) result[key] = flag(result[key]) ? 1 : 0;
  }
  if (typeof result.urls === 'string') { try { result.urls = JSON.parse(result.urls); } catch { result.urls = result.urls.split('\n').map(s => s.trim()).filter(Boolean); } }
  return result;
}
export function validateReDraft(payload) {
  const p = normalizeReDraft(payload);
  if (!String(p.campaign_name || '').trim()) throw Error('Nama kampanye RE wajib diisi.');
  if (!Array.isArray(p.urls) || !p.urls.length) throw Error('Minimal satu URL sumber RE wajib diisi.');
  if (![0,3,4,5].includes(Number(p.angle_multiplier || 0))) throw Error('Angle multiplier RE tidak valid.');
  if (p.execution_mode && !['full_autopilot','manual_review'].includes(p.execution_mode)) throw Error('Mode eksekusi RE tidak valid.');
  if (p.is_bridging_active) {
    if (Number(p.bridge_at_clip) < 2 || Number(p.bridge_at_clip) > Number(p.target_clips_count)) throw Error('Posisi bridging RE tidak valid.');
    if (p.production_mode !== 'mass') {
      if (p.bridging_mode === 'select_existing' && !p.target_product_id) throw Error('Pilih produk RE.');
      if (p.bridging_mode === 'url_extract' && !p.ephemeral_product_data) throw Error('URL produk RE wajib diisi.');
      if (p.bridging_mode === 'manual_input') {
        const product = typeof p.ephemeral_product_data === 'string' ? JSON.parse(p.ephemeral_product_data) : p.ephemeral_product_data;
        if (!product?.product_name?.trim() || !product?.product_description?.trim()) throw Error('Nama dan deskripsi produk RE wajib.');
      }
      if (p.visual_mode === 'hybrid_lock' && p.bridging_mode !== 'url_extract' && (!p.product_ref_image_path || !p.product_filename_declare)) throw Error('Foto dan deklarasi nama file Hybrid Lock wajib diisi.');
    }
  }
  return p;
}
