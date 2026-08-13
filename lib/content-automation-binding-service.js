import { getBrandProduct, upsertBrandProduct } from './brand-product-repository.js';

function text(value) { const normalized = String(value || '').trim(); return normalized || null; }

export async function ensureAutomationProductBinding({ brandProfileId, productId, bindingInput = {} }) {
  if (!brandProfileId || !productId) { const error = new Error('Brand Profile dan Produk wajib dipilih.'); error.status = 400; throw error; }
  if (bindingInput.product_id && bindingInput.product_id !== productId) { const error = new Error('Product binding tidak konsisten dengan planner.'); error.status = 400; throw error; }
  const existing = await getBrandProduct({ brandProfileId, productId });
  if (existing?.is_active && !bindingInput.update_existing) return { binding: existing, action: 'reused' };
  const binding = await upsertBrandProduct({
    brandProfileId, productId,
    affiliateLink: text(bindingInput.affiliate_link) ?? existing?.affiliate_link ?? null,
    trackingCode: text(bindingInput.tracking_code), landingPageUrl: text(bindingInput.landing_page_url),
    productNameOverride: text(bindingInput.product_name_override), ctaOverride: text(bindingInput.cta_override),
    notes: text(bindingInput.notes), isActive: true
  });
  return { binding, action: existing ? (existing.is_active ? 'updated' : 'reactivated') : 'created' };
}

export async function prepareProductCampaignSchedule(body) {
  const planner = body?.operator_request?.planner || {};
  const result = await ensureAutomationProductBinding({ brandProfileId: planner.brand_id, productId: planner.product_id, bindingInput: body.product_binding || {} });
  return {
    body: { ...body, operator_request: { ...body.operator_request, planner: { ...planner, brand_product_id: result.binding.id } } },
    bindingAction: result.action, binding: result.binding
  };
}
