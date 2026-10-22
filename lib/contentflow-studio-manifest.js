// Pure shared contract: source identifies the brief, engine identifies the producer.
export const ENGINE_SOURCE_RULES = Object.freeze({
  pillar: ['planner_pillar', 'planner_recipe'], re: ['re_campaign'],
  multiplier: ['multiplier_lab'], recipe: ['recipe_labs']
});
export function studioError(message, code = 'STUDIO_INVALID_REQUEST', status = 400) {
  return Object.assign(new Error(message), { code, status });
}
export function validateEngineSource({ engineKind, sourceKind, plannerId }) {
  if (!ENGINE_SOURCE_RULES[engineKind]?.includes(sourceKind)) throw studioError('Jenis campaign dan sumber tidak sesuai.', 'STUDIO_ENGINE_UNSUPPORTED');
  if (engineKind === 'pillar' ? !plannerId : Boolean(plannerId)) throw studioError('Planner hanya diperlukan untuk jalur Pillar/Recipe Planner.');
}
export function buildOutputManifest(engineKind, payload, rows = []) {
  let outputs;
  if (engineKind === 'pillar') {
    outputs = rows.map(row => ({ outputKey: `planner:${row.id}`, title: row.title || row.hook || row.content_subject,
      plannerRowId: String(row.id), mediaType: 'video', snapshot: row }));
  } else if (engineKind === 're') {
    const urls = payload.urls || payload.urlsText?.split('\n').map(s => s.trim()).filter(Boolean) || [];
    if (!urls.length || urls.length > 100) throw studioError('RE memerlukan 1–100 sumber video.');
    outputs = urls.map((source, index) => {
      const sourceUrl = typeof source === 'string' ? source : source?.source_url;
      try { if (!['http:', 'https:'].includes(new URL(sourceUrl).protocol)) throw Error(); } catch { throw studioError('URL sumber RE tidak valid.'); }
      return { outputKey: `re:${index}`, title: `RE ${index + 1} · ${payload.campaign_name || sourceUrl}`, mediaType: 'video', snapshot: { source } };
    });
  } else if (engineKind === 'multiplier') {
    if (!Array.isArray(payload.rows) || !payload.rows.length || payload.rows.length > 20) throw studioError('Multiplier memerlukan 1–20 kombinasi.');
    outputs = payload.rows.map((row, index) => {
      if (!row.deconstruct_asset_id) throw studioError('Setiap kombinasi membutuhkan sumber deconstruct.');
      if (row.campaign_type !== 'pure_storytelling' && !row.target_product_id && !row.target_product_url) throw studioError('Produk kombinasi Multiplier wajib diisi.');
      return { outputKey: `multiplier:${index}`, title: row.angle_title || row.editorial_topic || `Kombinasi ${index + 1}`, mediaType: 'video', snapshot: { row } };
    });
  } else if (engineKind === 'recipe') {
    if (!payload.category) throw studioError('Kategori Recipe wajib diisi.');
    const count = Number(payload.target_recipe_count || 1);
    if (!Number.isInteger(count) || count < 1 || count > 20) throw studioError('Jumlah resep harus 1–20.');
    if (payload.campaign_type === 'video' && count !== 1) throw studioError('Recipe video existing menghasilkan satu output per konfigurasi.');
    outputs = Array.from({ length: count }, (_, index) => ({ outputKey: `recipe:${index}`, title: `Resep ${index + 1} · ${payload.custom_category || payload.category}`, mediaType: payload.campaign_type === 'video' ? 'video' : 'image', snapshot: { index } }));
  } else throw studioError('Engine produksi tidak didukung.', 'STUDIO_ENGINE_UNSUPPORTED');
  if (!outputs.length) throw studioError('Tidak ada output untuk dijadwalkan.');
  return outputs;
}
export function toZonedInput(iso, timezone = 'Asia/Jakarta') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function zonedInputToIso(value, timezone = 'Asia/Jakarta') {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value || '')) throw studioError('Waktu lokal tidak valid.');
  let instant = Date.parse(`${value}:00Z`);
  for (let n = 0; n < 3; n++) instant += Date.parse(`${value}:00Z`) - Date.parse(`${toZonedInput(instant, timezone)}:00Z`);
  if (toZonedInput(instant, timezone) !== value) throw studioError('Waktu tidak tersedia pada zona waktu ini.');
  return new Date(instant).toISOString();
}
