const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveProductReferenceRequirement({ campaign, item, clipIndex }) {
  const plan = parse(item?.new_video_plan_json, []);
  const normalizedClipIndex = positiveInteger(clipIndex, 0);
  const clip = plan.find(entry => Number(entry.clip_index) === normalizedClipIndex) || {};
  const bridgeStart = positiveInteger(campaign?.bridge_at_clip, 2);
  const bridgeDuration = positiveInteger(campaign?.bridge_duration_clips, 1);
  const bridgeEnd = bridgeStart + bridgeDuration - 1;
  const bridge = normalizedClipIndex >= bridgeStart && normalizedClipIndex <= bridgeEnd;
  const productCampaign = Boolean(campaign?.target_product_id || campaign?.product_id);
  const required = productCampaign && (bridge || clip.product_visible === true || clip.requires_product_reference === true);
  return {
    required,
    productCampaign,
    bridge,
    bridgeStart,
    bridgeEnd,
    reason: bridge ? 'bridge_range' : clip.requires_product_reference === true ? 'clip_metadata' : clip.product_visible === true ? 'product_visible' : 'not_required'
  };
}

export class ProductReferenceUnavailableError extends Error {
  constructor(message = 'Foto referensi produk wajib tetapi tidak tersedia.') { super(message); this.code = 'PRODUCT_REFERENCE_UNAVAILABLE'; this.status = 422; }
}
