import crypto from 'crypto';
import { getDb, getSetting } from './db.js';
import { getProductById } from './product-repository.js';
import { resolveCampaignProductReference } from './product-reference-resolver.js';
import { inspectBase64ImageReferences } from './base64-image-reference.js';
import { ProductReferenceUnavailableError, resolveProductReferenceRequirement } from './opc-start-frame-contract.js';

const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };

const uniqueDataReferences = references => Array.from(new Set((references || []).filter(reference => typeof reference === 'string' && reference.startsWith('data:image/'))));

const lockProductIdentityPrompt = (prompt, product) => {
  const sanitizedPrompt = String(prompt || '')
    .replace(/\(Product Reference File:\s*['"][^'"]*generated_[^'"]*['"][^)]*\)\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const productName = String(product?.name || product?.product_name || '').trim();
  return `[HIGHEST PRIORITY PRODUCT IDENTITY LOCK] The attached product reference image is the sole visual source of truth${productName ? ` for ${productName}` : ''}. Reproduce the exact same package identity, silhouette, materials, colors, logo, label artwork, typography, and printed details. Do not redesign, simplify, genericize, relabel, translate, substitute, or invent a different product package. Ignore any filename or textual product description that conflicts with the attached image. Preserve the attached package as a recognizable exact product while composing it naturally into the requested scene.\n\n${sanitizedPrompt}`;
};

export async function buildOpcStartFrameRequest({ campaign, item, clipIndex, prompt, origin = 'phase_1_initial', contextReferences = [], productLoader = getProductById, cwd = process.cwd() }) {
  const requirement = resolveProductReferenceRequirement({ campaign, item, clipIndex });
  const row = parse(item?.row_creative_payload);
  const productId = campaign?.target_product_id || campaign?.product_id || null;
  const product = requirement.required && productId ? await productLoader(productId) : null;
  const reference = requirement.required
    ? resolveCampaignProductReference({ product, fallbackPaths: productId ? [] : [campaign?.product_ref_image_path, row.product_ref_image_path], cwd })
    : null;
  if (requirement.required && !reference) throw new ProductReferenceUnavailableError();
  const safeContextReferences = uniqueDataReferences(contextReferences);
  const references = uniqueDataReferences([...safeContextReferences, ...(reference ? [reference.base64DataUrl] : [])]);
  const referenceMetadata = inspectBase64ImageReferences(references);
  const productReferenceCount = reference && references.includes(reference.base64DataUrl) ? 1 : 0;
  if ((requirement.required && productReferenceCount !== 1) || (!requirement.required && productReferenceCount !== 0)) {
    throw new Error('OPC_PRODUCT_REFERENCE_INVARIANT_FAILED');
  }
  const db = getDb();
  const brandProfile = campaign?.brand_profile_id ? await db.prepare('SELECT * FROM brand_profiles WHERE id=?').get(campaign.brand_profile_id) : null;
  const providerPrompt = reference ? lockProductIdentityPrompt(prompt, product) : prompt;
  const promptSha256 = hash(providerPrompt);
  const referenceSha256s = referenceMetadata.map(metadata => metadata.sha256);
  const fingerprint = hash(JSON.stringify({ clipIndex:Number(clipIndex), promptSha256, referenceSha256s, productReferenceSha256:reference?.sha256 || null, referenceCount:references.length, productReferenceCount, model:getSetting('webhook_image_model') || 'nano_banana_pro', aspectRatio:campaign?.aspect_ratio || '9:16' }));
  return {
    providerRequest: { prompt:providerPrompt, model:getSetting('webhook_image_model') || 'nano_banana_pro', aspect_ratio:campaign?.aspect_ratio || '9:16', reference_images:references.length ? references : undefined, expected_reference_sha256s:referenceSha256s, webhookOverride:brandProfile },
    audit: { origin, campaign_id:String(campaign?.id), campaign_item_id:String(item?.id), clip_index:Number(clipIndex), requires_product_reference:requirement.required, requirement_reason:requirement.reason, reference_count:references.length, product_reference_count:productReferenceCount, reference_source_field:reference?.sourceField || null, reference_sha256:reference?.sha256 || null, payload_reference_sha256:reference ? referenceMetadata.at(-1)?.sha256 || null : null, reference_mime_type:reference ? referenceMetadata.at(-1)?.mimeType || null : null, reference_byte_length:reference ? referenceMetadata.at(-1)?.byteLength || 0 : 0, bridge_start:requirement.bridgeStart, bridge_end:requirement.bridgeEnd, prompt_sha256:promptSha256, request_fingerprint:fingerprint }
  };
}
