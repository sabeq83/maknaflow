import { validateAndNormalizeEnginePayload } from './campaign-configuration/index.js';
import { validateStudioAssetReferences } from './contentflow-studio-assets.js';
import crypto from 'node:crypto';
import { withPgTransaction } from './db-pg.js';
import { buildOutputManifest, validateEngineSource, studioError } from './contentflow-studio-manifest.js';
import { validateStudioSchedule } from './contentflow-studio-contract.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const studioRequestHash = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export async function createStudioBatchAtomically(input) {
  const { tenantId, actorId, engineKind, sourceKind, plannerId = null, enginePayload = {}, outputSchedules, timezone = 'Asia/Jakarta', idempotencyKey, title } = input;
  validateEngineSource(input);
  if (!tenantId || !idempotencyKey || idempotencyKey.length > 200) throw studioError('Identitas tenant dan idempotency key wajib.');
  try { new Intl.DateTimeFormat('id-ID', { timeZone: timezone }).format(); } catch { throw studioError('Timezone tidak valid.'); }
  if (!Array.isArray(outputSchedules) || !outputSchedules.length) throw studioError('Jadwal output wajib diisi.');
  const requestHash = studioRequestHash({ engineKind, sourceKind, plannerId, enginePayload, outputSchedules, timezone, title });
  return withPgTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`studio-create:${tenantId}:${idempotencyKey}`]);
    const prior = (await client.query('SELECT * FROM content_studio_batches WHERE tenant_id=$1 AND idempotency_key=$2 FOR UPDATE', [tenantId, idempotencyKey])).rows[0];
    if (prior) {
      if (prior.request_hash !== requestHash) throw studioError('Idempotency key telah dipakai untuk konfigurasi berbeda.', 'STUDIO_IDEMPOTENCY_CONFLICT', 409);
      const slots = (await client.query('SELECT * FROM content_studio_slots WHERE batch_id=$1 AND tenant_id=$2 ORDER BY slot_number', [prior.id, tenantId])).rows;
      return { ...prior, slots, reused: true };
    }
    let planner = null, rows = [];
    if (engineKind === 'pillar') {
      planner = (await client.query('SELECT * FROM content_planners WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [plannerId, tenantId])).rows[0];
      if (!planner) throw studioError('Planner tenant aktif tidak ditemukan.', 'PLANNER_NOT_FOUND', 404);
      if (!['completed', 'ready', 'planned'].includes(planner.status)) throw studioError('Planner belum siap atau sudah digunakan.', 'PLANNER_NOT_READY', 409);
      if ((planner.planner_focus === 'recipe_campaign') !== (sourceKind === 'planner_recipe')) throw studioError('Focus Planner tidak sesuai jalur produksi.');
      if ((await client.query('SELECT id FROM content_planner_consumptions WHERE tenant_id=$1 AND planner_id=$2', [tenantId, plannerId])).rowCount) throw studioError('Planner sudah digunakan.', 'PLANNER_ALREADY_CONSUMED', 409);
      rows = (await client.query('SELECT * FROM content_planner_rows WHERE planner_id=$1 ORDER BY sequence', [plannerId])).rows;
      if (!rows.length) throw studioError('Planner belum memiliki baris konten yang selesai digenerate.', 'PLANNER_EMPTY_ROWS', 409);
      const selected = enginePayload.selected_row_ids;
      if (selected?.length) {
        const ids = new Set(selected.map(String));
        rows = rows.filter(r => ids.has(String(r.id)));
        if (ids.size !== rows.length) throw studioError('Baris tidak berasal dari Planner ini.');
      }
    }
    let config = engineKind === 'pillar' ? (enginePayload.global_settings || enginePayload) : enginePayload;
    if (Number(input.schemaVersion) >= 3) {
      config = validateAndNormalizeEnginePayload(engineKind,enginePayload);
    }
    await validateStudioAssetReferences({tenantId,config,client});
    {
      const references = [];
      const collect = value => {
        if (!value || typeof value !== 'object') return;
        for (const [key,item] of Object.entries(value)) {
          if (typeof item==='string' && key.endsWith('config_json')) { collect(JSON.parse(item)); continue; }
          const table = ['brand_profile_id','brandProfileId'].includes(key) ? 'brand_profiles'
            : key==='target_product_id' ? 'product_extractions'
            : ['source_deconstruct_asset_id','deconstruct_asset_id'].includes(key) ? 're_deconstructed_assets' : null;
          if (table && item) references.push([table,item]);
          if (item && typeof item==='object') collect(item);
        }
      };
      collect(config);
      for (const [table,id] of references) if (!(await client.query(`SELECT id FROM ${table} WHERE tenant_id=$1 AND id=$2`,[tenantId,id])).rowCount) throw studioError('Referensi konfigurasi bukan milik tenant aktif.','STUDIO_REFERENCE_NOT_OWNED',403);
    }
    const brandId = config.brand_profile_id;
    if (brandId && !(await client.query('SELECT id FROM brand_profiles WHERE id=$1 AND tenant_id=$2', [brandId, tenantId])).rowCount) throw studioError('Brand tidak ditemukan untuk tenant aktif.');
    const outputs = buildOutputManifest(engineKind, config, rows, {stableKeys:Number(input.schemaVersion)>=3});
    if (outputs.length !== outputSchedules.length || new Set(outputSchedules.map(s => s.outputKey)).size !== outputs.length) throw studioError('Jumlah/pemetaan jadwal harus sesuai output campaign.');
    const invocationTimes = new Map();
    for (const output of outputs) {
      const snapshot = output.snapshot;
      if (engineKind === 'multiplier') {
        if (!(await client.query('SELECT id FROM re_deconstructed_assets WHERE id=$1 AND tenant_id=$2', [snapshot.row.deconstruct_asset_id, tenantId])).rowCount) throw studioError('Sumber deconstruct tidak ditemukan pada tenant aktif.');
        if (snapshot.row.target_product_id && !(await client.query('SELECT id FROM product_extractions WHERE id=$1 AND tenant_id=$2', [snapshot.row.target_product_id, tenantId])).rowCount) throw studioError('Produk kombinasi bukan milik tenant aktif.');
      }
      const schedule = outputSchedules.find(s => s.outputKey === output.outputKey);
      if (!schedule) throw studioError('Jadwal output tidak ditemukan.');
      if (snapshot.invocationKey) {
        const time = new Date(schedule.productionAt).toISOString();
        if (invocationTimes.has(snapshot.invocationKey) && invocationTimes.get(snapshot.invocationKey) !== time) throw studioError('Varian angle dari sumber yang sama harus memiliki waktu mulai produksi yang sama.');
        invocationTimes.set(snapshot.invocationKey,time);
      }
      const accountIds = [...new Set(schedule.accountIds || [])];
      if (!accountIds.length) throw studioError('Pilih minimal satu akun tujuan.');
      const accounts = (await client.query('SELECT id,platform FROM publishing_accounts WHERE tenant_id=$1 AND id=ANY($2::text[]) AND status<>$3', [tenantId, accountIds, 'paused'])).rows;
      if (accounts.length !== accountIds.length) throw studioError('Akun tujuan tidak tersedia pada tenant aktif.');
      const validation = validateStudioSchedule({ scheduledProductionAt: schedule.productionAt, scheduledPublishAt: schedule.publishAt, timezone, targets: accounts.map(a => ({ accountId: a.id, platform: a.platform })) });
      if (!validation.valid || new Date(schedule.productionAt) >= new Date(schedule.publishAt)) throw studioError(validation.errors.join(' ') || 'Produksi harus sebelum tayang.');
      output.schedule = schedule; output.accounts = accounts;
    }
    const batchId = `stb_${crypto.randomUUID().replaceAll('-', '')}`;
    const batch = (await client.query(`INSERT INTO content_studio_batches(id,tenant_id,title,source_kind,engine_kind,source_id,config_version,configuration_json,idempotency_key,request_hash,status,total_slots,created_by)
      VALUES($1,$2,$3,$4,$5,$6,3,$7::jsonb,$8,$9,'draft',$10,$11) RETURNING *`,
      [batchId, tenantId, title || config.campaign_name || 'Studio Batch', sourceKind, engineKind, plannerId, JSON.stringify(config), idempotencyKey, requestHash, outputs.length, actorId])).rows[0];
    if (planner) {
      await client.query(`INSERT INTO content_planner_consumptions(id,tenant_id,planner_id,owner_type,owner_id,status,snapshot_sha256,metadata_json)
        VALUES($1,$2,$3,'studio_batch',$4,'consumed',$5,$6::jsonb)`, [`cpc_${crypto.randomUUID()}`, tenantId, plannerId, batchId, studioRequestHash(rows), JSON.stringify({ selected_row_ids: rows.map(r => r.id), actor: actorId })]);
      await client.query("UPDATE content_planners SET status='consumed',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2", [plannerId, tenantId]);
    }
    const slots = [];
    for (let n = 0; n < outputs.length; n++) {
      const o = outputs[n], id = `sts_${crypto.randomUUID().replaceAll('-', '')}`;
      const slot = (await client.query(`INSERT INTO content_studio_slots(id,tenant_id,batch_id,slot_number,planner_row_id,title,source_kind,output_key,output_snapshot_json,scheduled_production_at,scheduled_publish_at,timezone,output_media_type,activation_status,stage_status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,'manual','draft') RETURNING *`,
      [id, tenantId, batchId, n + 1, o.plannerRowId || null, o.title || `Konten ${n + 1}`, sourceKind, o.outputKey, JSON.stringify(o.snapshot), o.schedule.productionAt, o.schedule.publishAt, timezone, o.mediaType])).rows[0];
      for (const a of o.accounts) await client.query(`INSERT INTO content_studio_targets(id,tenant_id,slot_id,account_id,platform,scheduled_at,status) VALUES($1,$2,$3,$4,$5,$6,'awaiting_approval')`, [`stt_${crypto.randomUUID()}`, tenantId, id, a.id, a.platform, o.schedule.publishAt]);
      slots.push(slot);
    }
    return { ...batch, slots };
  });
}
