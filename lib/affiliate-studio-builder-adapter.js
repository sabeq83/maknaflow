import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';
import { pgQuery } from './db-pg.js';
import { generateContentFlexible, GEMINI_MODELS } from './gemini.js';

export async function suggestCampaignProgram(user, brandId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  // Retrieve products in brand for context
  const products = (await pgQuery(
    `SELECT pe.id, pe.product_name, pe.category, bp.id as brand_product_id 
     FROM brand_products bp
     JOIN product_extractions pe ON bp.product_id = pe.id
     WHERE bp.tenant_id = $1 AND bp.brand_profile_id = $2 AND bp.is_active = TRUE LIMIT 5`,
    [tenantId, brand.id]
  )).rows;

  const productsContext = products.map(p => `- Product ID: ${p.brand_product_id}, Name: ${p.product_name}, Category: ${p.category}`).join('\n');

  const systemInstruction = `You are a strategic marketing assistant for MAKNA Flow Affiliate Studio.
Based on the brand profile and product context below, suggest a structured campaign program configuration in JSON format.
Return ONLY valid JSON, no markdown blocks, no explanation.

JSON Schema:
{
  "name": "Campaign Program Name",
  "funnelMix": { "tofu": 40, "mofu": 40, "bofu": 20 },
  "platforms": ["tiktok", "instagram"],
  "productionTarget": 5,
  "targetDemographic": "Target demographic details",
  "aiDirective": "AI directives for visual hook generation",
  "mandatoryOutroLine": "Mandatory outro line"
}`;

  const userPrompt = `Brand: ${brand.brandName}
Category: ${brand.vertical || 'Generic'}
Products available:\n${productsContext || 'None'}`;

  let suggestedJson;
  try {
    const combinedPrompt = `${systemInstruction}\n\n## SPESIFIKASI DAN ATURAN STRUKTUR\n${userPrompt}`;
    const rawResponse = await generateContentFlexible({
      prompt: combinedPrompt,
      modelName: GEMINI_MODELS.PRIMARY,
      timeoutMs: 180000
    });
    // Sanitize markdown wrapper if any
    const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    suggestedJson = JSON.parse(cleanJson);
  } catch (err) {
    console.error('[Gemini Assisted Builder Error]', err.message);
    // Fallback recommendation
    suggestedJson = {
      name: `${brand.brandName} Auto Campaign`,
      funnelMix: { tofu: 40, mofu: 40, bofu: 20 },
      platforms: ['tiktok'],
      productionTarget: 5,
      targetDemographic: 'General audience interested in lifestyle products',
      aiDirective: 'Focus on highlighting organic product utility and daily routine usage.',
      mandatoryOutroLine: 'Follow us for more updates!'
    };
  }

  return suggestedJson;
}
