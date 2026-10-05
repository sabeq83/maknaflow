import crypto from 'crypto';
import { getDb } from './db.js';
import { getProductById } from './product-repository.js';
import { resolveCampaignProductReference } from './product-reference-resolver.js';
import { inspectBase64ImageReference, inspectBase64ImageReferences } from './base64-image-reference.js';
import { ProductReferenceUnavailableError, resolveProductReferenceRequirement } from './opc-start-frame-contract.js';

const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };

function sanitizeTag(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

function extensionForMime(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

const lockProductIdentityPrompt = (prompt, product, productTag) => {
  const sanitizedPrompt = String(prompt || '')
    .replace(/\(Product Reference File:\s*['"][^'"]*generated_[^'"]*['"][^)]*\)\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const productName = String(product?.name || product?.product_name || '').trim();
  return `[HIGHEST PRIORITY PRODUCT IDENTITY LOCK] The attached product reference @${productTag} is the sole visual source of truth${productName ? ` for ${productName}` : ''}. Reproduce the exact same package identity, silhouette, materials, colors, logo, label artwork, typography, and printed details. Do not redesign, simplify, genericize, relabel, translate, substitute, or invent a different product package. Ignore any filename or textual product description that conflicts with the attached image. Preserve the attached package as a recognizable exact product while composing it naturally into the requested scene.\n\n${sanitizedPrompt}`;
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

  const productTag = `product_truth_${sanitizeTag(product?.id || productId || 'product')}`;
  const productReference = reference ? {
    data: reference.base64DataUrl,
    category: 'subject',
    name: `${productTag}.${extensionForMime(reference.mimeType)}`
  } : null;

  let effectiveContextReferences = [...(contextReferences || [])];
  const isCartoonWorld = campaign?.content_world === 'cartoon_universe' || row?.content_world === 'cartoon_universe';

  // Auto-resolve character context references if not explicitly provided
  if (isCartoonWorld && effectiveContextReferences.length === 0) {
    try {
      const plan = parse(item?.new_video_plan_json, []);
      const planEntry = Array.isArray(plan) ? plan.find(p => Number(p.clip_index) === Number(clipIndex)) : null;
      const clipCharacters = Array.isArray(planEntry?.characters) ? planEntry.characters : [];
      let universeSnapshot = null;
      let visualIdentitySnapshot = null;
      try { universeSnapshot = campaign?.universe_snapshot_json ? JSON.parse(campaign.universe_snapshot_json) : null; } catch (_) {}
      try { visualIdentitySnapshot = campaign?.visual_overrides_json ? JSON.parse(campaign.visual_overrides_json) : null; } catch (_) {}

      const { resolveClipReferenceImagesAsync } = await import('./cartoon-reference-resolver.js');
      const resolved = await resolveClipReferenceImagesAsync({
        contentWorld: 'cartoon_universe',
        universeProfile: campaign?.universe_profile || row?.universe_profile || 'pawville',
        universeSnapshot,
        visualIdentitySnapshot,
        clip: clipIndex,
        promptText: prompt,
        productReference: null,
        productRevealBeat: row?.product_reveal_beat || campaign?.product_reveal_beat || 'none',
        clipCharacters
      });
      if (resolved?.allReferences?.length) {
        effectiveContextReferences = resolved.allReferences;
      }
    } catch (resolveErr) {
      console.warn('[buildOpcStartFrameRequest] Failed auto-resolving cartoon references:', resolveErr.message);
    }
  }

  const references = [];
  const seenSha = new Set();

  if (productReference) {
    references.push(productReference);
    seenSha.add(reference.sha256);
  }

  for (const ctxRef of effectiveContextReferences) {
    if (!ctxRef) continue;
    try {
      const meta = inspectBase64ImageReference(ctxRef);
      if (!seenSha.has(meta.sha256)) {
        seenSha.add(meta.sha256);
        references.push(ctxRef);
      }
    } catch (_) {
      // Ignore invalid context references
    }
  }

  const referenceMetadata = inspectBase64ImageReferences(references);
  const productReferenceCount = reference && referenceMetadata.length > 0 && referenceMetadata[0].sha256 === reference.sha256 ? 1 : 0;
  if ((requirement.required && productReferenceCount !== 1) || (!requirement.required && productReferenceCount !== 0)) {
    throw new Error('OPC_PRODUCT_REFERENCE_INVARIANT_FAILED');
  }

  const db = getDb();
  const brandProfile = campaign?.brand_profile_id ? await db.prepare('SELECT * FROM brand_profiles WHERE id=?').get(campaign.brand_profile_id) : null;
  const providerPrompt = reference ? lockProductIdentityPrompt(prompt, product, productTag) : prompt;
  const promptSha256 = hash(providerPrompt);
  const referenceSha256s = referenceMetadata.map(metadata => metadata.sha256);
  const requestedModel = 'nano_banana_2';
  const fingerprint = hash(JSON.stringify({
    clipIndex: Number(clipIndex),
    promptSha256,
    referenceSha256s,
    productReferenceSha256: reference?.sha256 || null,
    referenceCount: references.length,
    productReferenceCount,
    model: requestedModel,
    aspectRatio: campaign?.aspect_ratio || '9:16'
  }));

  const cartoonNegativePrompt = 'photorealistic human photography, real live-action person, uncanny valley, ugly, bad anatomy, distorted limbs, extra fingers, missing fingers, blurry, low resolution, 2D flat vector clipart';
  const defaultFacelessNegativePrompt = 'human face, facial features, eyes, nose, mouth, head, headshot, portrait, hair, neck, torso, chest, shoulders, upper body, selfie, looking at camera, blurry hands, extra fingers, missing fingers, distorted limbs';
  const effectiveNegativePrompt = isCartoonWorld ? cartoonNegativePrompt : defaultFacelessNegativePrompt;

  return {
    providerRequest: {
      prompt: providerPrompt,
      negative_prompt: effectiveNegativePrompt,
      model: requestedModel,
      aspect_ratio: campaign?.aspect_ratio || '9:16',
      reference_images: references.length ? references : undefined,
      expected_reference_sha256s: referenceSha256s,
      webhookOverride: brandProfile
    },
    audit: {
      origin,
      campaign_id: String(campaign?.id),
      campaign_item_id: String(item?.id),
      clip_index: Number(clipIndex),
      requires_product_reference: requirement.required,
      requirement_reason: requirement.reason,
      reference_count: references.length,
      product_reference_count: productReferenceCount,
      reference_source_field: reference?.sourceField || null,
      reference_name: reference ? productReference.name : null,
      reference_position: reference ? 0 : null,
      reference_sha256: reference?.sha256 || null,
      payload_reference_sha256: reference ? referenceMetadata[0]?.sha256 || null : null,
      reference_mime_type: reference ? referenceMetadata[0]?.mimeType || null : null,
      reference_byte_length: reference ? referenceMetadata[0]?.byteLength || 0 : 0,
      requested_model: requestedModel,
      effective_model: requestedModel,
      bridge_start: requirement.bridgeStart,
      bridge_end: requirement.bridgeEnd,
      prompt_sha256: promptSha256,
      request_fingerprint: fingerprint
    }
  };
}
