import crypto from 'crypto';
import { getDb, getSetting } from './db.js';
import { getProductById } from './product-repository.js';
import { resolveActiveProductReference } from './product-reference-resolver.js';
import { ProductReferenceUnavailableError, resolveProductReferenceRequirement } from './opc-start-frame-contract.js';

const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };

export async function buildOpcStartFrameRequest({ campaign, item, clipIndex, prompt, origin = 'phase_1_initial', extraReferences = [] }) {
  const requirement = resolveProductReferenceRequirement({ campaign, item, clipIndex });
  const row = parse(item?.row_creative_payload);
  const productId = campaign?.target_product_id || campaign?.product_id || null;
  const product = productId ? await getProductById(productId) : null;
  const reference = resolveActiveProductReference({ product, fallbackPaths: [campaign?.product_ref_image_path, row.product_ref_image_path] });
  if (requirement.required && !reference) throw new ProductReferenceUnavailableError();
  const references = [...extraReferences];
  if (requirement.required && reference && !references.includes(reference.base64DataUrl)) references.push(reference.base64DataUrl);
  const db = getDb();
  const brandProfile = campaign?.brand_profile_id ? await db.prepare('SELECT * FROM brand_profiles WHERE id=?').get(campaign.brand_profile_id) : null;
  const promptSha256 = hash(prompt);
  const fingerprint = hash(JSON.stringify({ clipIndex:Number(clipIndex), promptSha256, referenceSha256:reference?.sha256 || null, referenceCount:references.length, model:getSetting('webhook_image_model') || 'nano_banana_pro', aspectRatio:campaign?.aspect_ratio || '9:16' }));
  return {
    providerRequest: { prompt, model:getSetting('webhook_image_model') || 'nano_banana_pro', aspect_ratio:campaign?.aspect_ratio || '9:16', reference_images:references.length ? references : undefined, webhookOverride:brandProfile },
    audit: { origin, campaign_id:String(campaign?.id), campaign_item_id:String(item?.id), clip_index:Number(clipIndex), requires_product_reference:requirement.required, requirement_reason:requirement.reason, reference_count:references.length, reference_source_field:reference?.sourceField || null, reference_sha256:reference?.sha256 || null, prompt_sha256:promptSha256, request_fingerprint:fingerprint }
  };
}
