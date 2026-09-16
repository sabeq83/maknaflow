import { getDb } from './db.js';
import { getGeminiModel } from './gemini.js';
import { v4 as uuidv4 } from 'uuid';
import { getActiveTenantId } from './tenant-context.js';
import { validateRecipePlannerDraft, validateCanonicalRecipe } from './recipe-campaign-contract.js';

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Execute Gemini AI Single-Pass Generation for N Recipe Planner Ideas
 */
export async function executeRecipePlanner({ planner }) {
  const db = getDb();
  const tenantId = planner.tenant_id || getActiveTenantId();
  const count = Number.parseInt(planner.planner_count, 10) || 5;

  let recipeConfig = {};
  try {
    recipeConfig = typeof planner.recipe_config_json === 'string'
      ? JSON.parse(planner.recipe_config_json || '{}')
      : (planner.recipe_config_json || {});
  } catch (e) {
    recipeConfig = {};
  }

  let productsSnapshot = [];
  try {
    productsSnapshot = typeof planner.products_snapshot_json === 'string'
      ? JSON.parse(planner.products_snapshot_json || '[]')
      : (planner.products_snapshot_json || []);
  } catch (e) {
    productsSnapshot = [];
  }

  // If snapshot is empty, lookup from DB products
  if (productsSnapshot.length === 0 && Array.isArray(recipeConfig.product_ids) && recipeConfig.product_ids.length > 0) {
    const placeholders = recipeConfig.product_ids.map(() => '?').join(',');
    const foundProds = await db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...recipeConfig.product_ids);
    productsSnapshot = (foundProds || []).map(p => ({
      product_id: p.id,
      name: p.product_name,
      description: p.product_description,
      usp: p.unique_selling_point,
      reference_image: p.product_photo_url || p.photo_url || null
    }));
  }

  const category = recipeConfig.category || 'minuman';
  const targetAudience = planner.target_audience || 'genz_casual';
  const promotionContext = planner.promotion_context || '';
  const customInstructions = planner.custom_instructions || '';

  const productsContext = productsSnapshot.map((p, idx) => {
    return `[Product #${idx + 1}] ID: "${p.product_id}", Name: "${p.name}", Description: "${p.description || '-'}", USP: "${p.usp || '-'}"`;
  }).join('\n');

  const systemInstruction = `You are MAKNA Culinary Campaign Engine, a world-class culinary director and social media recipe specialist.
Generate realistic, viral, and delicious culinary recipe concepts where client products are naturally used as ingredients, cooking tools, or plating accents.

PRINSIP INTEGRASI PRODUK NATURAL:
- Produk klien harus digunakan secara nyata dan masuk akal dalam aksi memasak (misal: susu oat dituang saat frothing, bubuk matcha dilarutkan, sirup gula aren di-drizzle).
- JANGAN memaksakan slot iklan terpisah (affiliate insert terpisah) dan JANGAN mengarang klaim yang tidak masuk akal.
- Rotasikan 1 produk utama per resep dari daftar produk yang disediakan.

OUTPUT REQUIREMENT:
Return a JSON object containing exactly ${count} recipe ideas in key "recipe_rows".`;

  const prompt = `
TARGET CONFIGURATION:
- Jumlah Ide Resep: ${count}
- Kategori Kuliner: ${category}
- Target Demografi Audiens: ${targetAudience}
- Konteks Promosi / Sudut Pandang: ${promotionContext || 'Resep Kafe Praktis & Enak di Rumah'}
- Instruksi Khusus: ${customInstructions || 'Gunakan gaya bahasa yang engaging dan takaran yang jelas.'}

DAFTAR PRODUK KATALOG TERSEDIA:
${productsContext || 'Produk Kuliner Umum'}

JSON SCHEMA OUTPUT:
{
  "recipe_rows": [
    {
      "sequence": 1,
      "title": "Nama Resep Menarik & Menggugah Selera",
      "category": "${category}",
      "hook": "Hook video 3 detik pertama yang relate dengan target audiens",
      "primary_product_id": "ID produk utama dari daftar",
      "primary_product_name": "Nama produk utama",
      "product_role": "ingredient / seasoning / equipment",
      "integration_reason": "Alasan mengapa produk ini membuat resep lebih enak/mudah",
      "integration_step_hint": "Langkah spesifik saat produk digunakan dalam video",
      "visual_highlight": "Highlight visual paling estetik (misal: efek matcha waterfall / swirl)",
      "estimated_servings": "1-2 Porsi",
      "estimated_cooking_minutes": 5,
      "cta": "Call to action mengajak audiens mencoba resep & cek link/keranjang"
    }
  ]
}`;

  const model = await getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json'
    }
  });

  const responseText = result.response.text();
  const parsed = JSON.parse(cleanJsonResponse(responseText));
  const rawRows = parsed.recipe_rows || parsed.rows || [];

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error('Gemini tidak menghasilkan baris resep yang valid.');
  }

  // Delete any existing draft rows for this planner before replacing
  await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(planner.id);

  const savedRows = [];
  for (let i = 0; i < count; i++) {
    const raw = rawRows[i] || rawRows[0];
    const rowId = `cpr_${uuidv4().substring(0, 8)}`;
    const matchedProduct = productsSnapshot.find(p => p.product_id === raw.primary_product_id) || productsSnapshot[i % (productsSnapshot.length || 1)] || {};

    const recipeIdea = {
      title: raw.title || `Resep Kuliner #${i + 1}`,
      category: raw.category || category,
      hook: raw.hook || 'Rahasia resep enak 3 menit di rumah!',
      primary_product_id: matchedProduct.product_id || raw.primary_product_id || null,
      primary_product_name: matchedProduct.name || raw.primary_product_name || null,
      product_role: raw.product_role || 'ingredient',
      integration_reason: raw.integration_reason || '',
      integration_step_hint: raw.integration_step_hint || '',
      visual_highlight: raw.visual_highlight || '',
      estimated_servings: raw.estimated_servings || '1-2 Porsi',
      estimated_cooking_minutes: raw.estimated_cooking_minutes || 5,
      cta: raw.cta || 'Simpan resep ini & coba di rumah ya!'
    };

    await db.prepare(`
      INSERT INTO content_planner_rows (
        id, planner_id, tenant_id, sequence, title, hook, status, recipe_idea_json, recipe_revision,
        product_reference, product, cta, visual_action, commercial_intent, cta_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rowId,
      planner.id,
      tenantId,
      i + 1,
      recipeIdea.title,
      recipeIdea.hook,
      'planned',
      JSON.stringify(recipeIdea),
      1,
      recipeIdea.primary_product_name,
      recipeIdea.primary_product_name,
      recipeIdea.cta,
      recipeIdea.visual_highlight,
      'soft_sell',
      'product'
    );

    savedRows.push({
      id: rowId,
      sequence: i + 1,
      ...recipeIdea,
      status: 'planned'
    });
  }

  await db.prepare(`UPDATE content_planners SET status = 'planned' WHERE id = ?`).run(planner.id);

  return {
    success: true,
    planner_id: planner.id,
    count: savedRows.length,
    rows: savedRows
  };
}

/**
 * Regenerate single recipe idea preserving constraints
 */
export async function regenerateRecipeIdea({ planner, rowId, userInstructions }) {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM content_planner_rows WHERE id = ? AND planner_id = ?').get(rowId, planner.id);
  if (!row) throw new Error('Baris planner tidak ditemukan.');

  let currentIdea = {};
  try {
    currentIdea = JSON.parse(row.recipe_idea_json || '{}');
  } catch (e) {
    currentIdea = {};
  }

  const prompt = `Regenerate single recipe idea for:
- Current Title: "${currentIdea.title || row.title}"
- Product: "${row.product_reference || currentIdea.primary_product_name}"
- Category: "${currentIdea.category || 'minuman'}"
- User Instructions: "${userInstructions || 'Buat hook lebih viral dan visual lebih menarik'}"

Return JSON matching single recipe object schema: { "title", "hook", "visual_highlight", "cta", "estimated_servings", "estimated_cooking_minutes" }`;

  const model = await getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, responseMimeType: 'application/json' }
  });

  const parsed = JSON.parse(cleanJsonResponse(result.response.text()));
  const updatedIdea = {
    ...currentIdea,
    title: parsed.title || currentIdea.title,
    hook: parsed.hook || currentIdea.hook,
    visual_highlight: parsed.visual_highlight || currentIdea.visual_highlight,
    cta: parsed.cta || currentIdea.cta,
    estimated_servings: parsed.estimated_servings || currentIdea.estimated_servings,
    estimated_cooking_minutes: parsed.estimated_cooking_minutes || currentIdea.estimated_cooking_minutes
  };

  const newRevision = (row.recipe_revision || 1) + 1;
  await db.prepare(`
    UPDATE content_planner_rows
    SET title = ?, hook = ?, visual_action = ?, cta = ?, recipe_idea_json = ?, recipe_revision = ?
    WHERE id = ?
  `).run(
    updatedIdea.title,
    updatedIdea.hook,
    updatedIdea.visual_highlight,
    updatedIdea.cta,
    JSON.stringify(updatedIdea),
    newRevision,
    rowId
  );

  return { success: true, row_id: rowId, recipe_idea: updatedIdea, revision: newRevision };
}
