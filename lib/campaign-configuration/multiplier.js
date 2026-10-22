export const multiplierSections = ['Workflow, Blueprint & Kombinasi','Basic Creative Strategy','Aesthetics & Visual Settings','Product Bridging Settings','Visual Identity'];
export const multiplierModes = ['one_blueprint_multi_angle','multi_blueprint_one_angle','multi_blueprint_one_product','one_blueprint_multi_product'];
export function validateMultiplierDraft(payload) {
  if (payload.mode && !multiplierModes.includes(payload.mode)) throw Error('Workflow Multiplier tidak valid.');
  if (!Array.isArray(payload.rows) || !payload.rows.length || payload.rows.length > 20) throw Error('Multiplier memerlukan 1–20 kombinasi sesuai menu asal.');
  for (const row of payload.rows) {
    if (!row.deconstruct_asset_id) throw Error('Blueprint kombinasi Multiplier wajib.');
    const bridging = typeof payload.bridging_config_json === 'string' ? JSON.parse(payload.bridging_config_json) : payload.bridging_config_json;
    const pure = row.campaign_type === 'pure_storytelling' || bridging?.campaign_type === 'pure_storytelling' || bridging?.is_bridging_active === false;
    if (!pure && !row.target_product_id && !row.target_product_url) throw Error('Produk kombinasi Multiplier wajib.');
  }
  for (const key of ['vso_config_json','bridging_config_json','audio_config_json']) if (typeof payload[key] === 'string') JSON.parse(payload[key]);
  return { ...payload };
}
