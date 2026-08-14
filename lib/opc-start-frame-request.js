import crypto from 'crypto';
import { getDb, getSetting } from './db.js';
import { getProductById } from './product-repository.js';
import { resolveActiveProductReference } from './product-reference-resolver.js';
import { ProductReferenceUnavailableError, resolveProductReferenceRequirement } from './opc-start-frame-contract.js';

const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };

const uniqueDataReferences = references => Array.from(new Set((references || []).filter(reference => typeof reference === 'string' && reference.startsWith('data:image/'))));

export async function buildOpcStartFrameRequest({ campaign, item, clipIndex, prompt, origin = 'phase_1_initial', contextReferences = [], productLoader = getProductById, cwd = process.cwd() }) {
  const requirement = resolveProductReferenceRequirement({ campaign, item, clipIndex });
  const row = parse(item?.row_creative_payload);
  const productId = campaign?.target_product_id || campaign?.product_id || null;
  const product = requirement.required && productId ? await productLoader(productId) : null;
  const reference = requirement.required
    ? resolveActiveProductReference({ product, fallbackPaths: [campaign?.product_ref_image_path, row.product_ref_image_path], cwd })
    : null;
  if (requirement.required && !reference) throw new ProductReferenceUnavailableError();
  const safeContextReferences = uniqueDataReferences(contextReferences);
  const references = uniqueDataReferences([...safeContextReferences, ...(reference ? [reference.base64DataUrl] : [])]);
  const productReferenceCount = reference && references.includes(reference.base64DataUrl) ? 1 : 0;
  if ((requirement.required && productReferenceCount !== 1) || (!requirement.required && productReferenceCount !== 0)) {
    throw new Error('OPC_PRODUCT_REFERENCE_INVARIANT_FAILED');
  }
  const db = getDb();
  const brandProfile = campaign?.brand_profile_id ? await db.prepare('SELECT * FROM brand_profiles WHERE id=?').get(campaign.brand_profile_id) : null;
  const promptSha256 = hash(prompt);
  const referenceSha256s = references.map(hash);
  const fingerprint = hash(JSON.stringify({ clipIndex:Number(clipIndex), promptSha256, referenceSha256s, productReferenceSha256:reference?.sha256 || null, referenceCount:references.length, productReferenceCount, model:getSetting('webhook_image_model') || 'nano_banana_pro', aspectRatio:campaign?.aspect_ratio || '9:16' }));
  return {
    providerRequest: { prompt, model:getSetting('webhook_image_model') || 'nano_banana_pro', aspect_ratio:campaign?.aspect_ratio || '9:16', reference_images:references.length ? references : undefined, webhookOverride:brandProfile },
    audit: { origin, campaign_id:String(campaign?.id), campaign_item_id:String(item?.id), clip_index:Number(clipIndex), requires_product_reference:requirement.required, requirement_reason:requirement.reason, reference_count:references.length, product_reference_count:productReferenceCount, reference_source_field:reference?.sourceField || null, reference_sha256:reference?.sha256 || null, bridge_start:requirement.bridgeStart, bridge_end:requirement.bridgeEnd, prompt_sha256:promptSha256, request_fingerprint:fingerprint }
  };
}
