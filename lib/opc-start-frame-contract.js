const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };

export function resolveProductReferenceRequirement({ campaign, item, clipIndex }) {
  const plan = parse(item?.new_video_plan_json, []);
  const clip = plan.find(entry => Number(entry.clip_index) === Number(clipIndex)) || {};
  const bridgeStart = Number(campaign?.bridge_at_clip || 2);
  const bridgeEnd = bridgeStart + Math.max(1, Number(campaign?.bridge_duration_clips || 1)) - 1;
  const bridge = Number(clipIndex) >= bridgeStart && Number(clipIndex) <= bridgeEnd;
  const productCampaign = Boolean(campaign?.target_product_id || campaign?.product_id);
  const required = productCampaign && (bridge || clip.product_visible === true || clip.requires_product_reference === true);
  return { required, productCampaign, bridge, reason: clip.requires_product_reference ? 'clip_metadata' : clip.product_visible ? 'product_visible' : bridge ? 'bridge_range' : 'not_required' };
}

export class ProductReferenceUnavailableError extends Error {
  constructor(message = 'Foto referensi produk wajib tetapi tidak tersedia.') { super(message); this.code = 'PRODUCT_REFERENCE_UNAVAILABLE'; this.status = 422; }
}
