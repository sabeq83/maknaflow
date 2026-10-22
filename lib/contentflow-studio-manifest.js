import { validateMultiplierDraft } from './campaign-configuration/multiplier.js';
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
export function studioSourceKey(value) {
  const canonical = item => Array.isArray(item) ? item.map(canonical) : item && typeof item==='object' ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,canonical(item[key])])) : item;
  let hash=14695981039346656037n;
  for (const character of JSON.stringify(canonical(value))) hash=BigInt.asUintN(64,(hash^BigInt(character.codePointAt(0)))*1099511628211n);
  return hash.toString(16).padStart(16,'0');
}
export function buildOutputManifest(engineKind, payload, rows = [], {stableKeys=false} = {}) {
  let outputs;
  if (engineKind === 'pillar') {
    outputs = rows.map(row => ({ outputKey: `planner:${row.id}`, title: row.title || row.hook || row.content_subject,
      plannerRowId: String(row.id), mediaType: 'video', snapshot: row }));
  } else if (engineKind === 're') {
    const urls = payload.urls || payload.urlsText?.split('\n').map(s => s.trim()).filter(Boolean) || [];
    if (!urls.length) throw studioError('RE memerlukan minimal satu sumber video.');
    const occurrences = new Map();
    outputs = urls.flatMap((source, index) => {
      const sourceUrl = typeof source === 'string' ? source : source?.source_url;
      try { if (!['http:', 'https:'].includes(new URL(sourceUrl).protocol)) throw Error(); } catch { throw studioError('URL sumber RE tidak valid.'); }
      const count = Number(payload.angle_multiplier || 0);
      if (![0,3,4,5].includes(count)) throw studioError('Angle multiplier RE tidak valid.');
      const fingerprint = JSON.stringify(source);
      const occurrence = occurrences.get(fingerprint) || 0;
      occurrences.set(fingerprint, occurrence + 1);
      const invocationKey = `re:${studioSourceKey(source)}:${occurrence}`;
      return Array.from({length: count || 1}, (_, variantIndex) => ({
        outputKey: count ? `${invocationKey}:angle:${variantIndex}` : stableKeys ? invocationKey : `re:${index}`,
        title: `RE ${index + 1}${count ? ` · Angle ${variantIndex + 1}` : ''} · ${payload.campaign_name || sourceUrl}`,
        mediaType: 'video', snapshot: { source, ...(count ? { invocationKey, variantIndex, variantCount: count } : {}) }
      }));
    });
  } else if (engineKind === 'multiplier') {
    try { validateMultiplierDraft(payload); } catch (error) { throw studioError(error.message); }
    outputs = payload.rows.map((row, index) => {
      if (!row.deconstruct_asset_id) throw studioError('Setiap kombinasi membutuhkan sumber deconstruct.');
      return { outputKey: stableKeys ? `multiplier:${studioSourceKey(row)}:${payload.rows.slice(0,index).filter(previous=>studioSourceKey(previous)===studioSourceKey(row)).length}` : `multiplier:${index}`, title: row.angle_title || row.editorial_topic || `Kombinasi ${index + 1}`, mediaType: 'video', snapshot: { row } };
    });
  } else if (engineKind === 'recipe') {
    if (!payload.category) throw studioError('Kategori Recipe wajib diisi.');
    const count = Number(payload.target_recipe_count || 1);
    if (!Number.isInteger(count) || count < 1 || count > 20) throw studioError('Jumlah resep harus 1–20.');
    if (payload.campaign_type === 'video' && count !== 1) throw studioError('Recipe video existing menghasilkan satu output per konfigurasi.');
    outputs = Array.from({ length: count }, (_, index) => ({ outputKey: stableKeys ? `recipe:${studioSourceKey({...payload,target_recipe_count:undefined})}:${index}` : `recipe:${index}`, title: `Resep ${index + 1} · ${payload.custom_category || payload.category}`, mediaType: payload.campaign_type === 'video' ? 'video' : 'image', snapshot: { index } }));
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

let studioKeySequence = 0;
// Idempotency keys are request identifiers, never authentication credentials.
// randomUUID is secure-context-only; getRandomValues is available on HTTP too.
export function createStudioIdempotencyKey(provider = globalThis.crypto) {
  try {
    if (typeof provider?.randomUUID === 'function') return provider.randomUUID();
  } catch { /* Restricted API: use the HTTP-compatible path below. */ }
  try {
    if (typeof provider?.getRandomValues === 'function') {
      const bytes = provider.getRandomValues(new Uint8Array(16));
      return `studio_${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
    }
  } catch { /* A request key must not prevent the user from opening the wizard. */ }
  studioKeySequence += 1;
  return `studio_${Date.now().toString(36)}_${studioKeySequence.toString(36)}_${Math.random().toString(36).slice(2)}`;
}
