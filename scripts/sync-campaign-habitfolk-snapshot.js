import { getDb } from '../lib/db.js';

export async function syncCampaignHabitfolkSnapshot(campaignId = 'opc_261024_ggrm6a') {
  const db = getDb();
  
  // 1. Ambil config_json terbaru dari preset HabitFolk
  const preset = await db.prepare("SELECT * FROM visual_identity_presets WHERE id = 'vi_habitfolk_macro_craft'").get();
  if (!preset) {
    throw new Error('Preset vi_habitfolk_macro_craft tidak ditemukan di database.');
  }

  const structured = typeof preset.config_json === 'string'
    ? JSON.parse(preset.config_json)
    : preset.config_json;

  const newSnapshot = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: {
      id: preset.id,
      key: preset.preset_key,
      version: preset.version || 2,
      source: 'user'
    },
    structured
  };

  const snapshotJson = JSON.stringify(newSnapshot);

  // 2. Update kampanye target
  const res = await db.prepare(`
    UPDATE pillar_campaigns 
    SET visual_overrides_json = ?, visual_identity_preset_id = ?, visual_identity_preset_version = ?
    WHERE id = ?
  `).run(snapshotJson, preset.id, preset.version || 2, campaignId);

  console.log(`✅ Updated visual_overrides_json for campaign ${campaignId}:`, res);
}

if (process.argv[1]?.endsWith('sync-campaign-habitfolk-snapshot.js')) {
  syncCampaignHabitfolkSnapshot()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error syncing snapshot:', err);
      process.exit(1);
    });
}
