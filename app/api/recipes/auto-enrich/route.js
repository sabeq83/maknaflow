import { NextResponse } from 'next/server.js';
import { getGeminiModel } from '../../../../lib/gemini.js';
import { parseGeminiJSON } from '../../../../lib/json-parser.js';
import { withTenantContext } from '../../../../lib/auth.js';
import { detectRecipeLanguage } from '../../../../lib/recipe-export-helper.js';

export const POST = withTenantContext(async (req) => {
  try {
    const { title, currentIngredients, currentDirections } = await req.json();

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Judul resep wajib diisi.' }, { status: 400 });
    }

    const lang = detectRecipeLanguage(title, currentIngredients, currentDirections);
    const isEnglish = (lang === 'en');
    const targetLangName = isEnglish ? 'BAHASA INGGRIS (English)' : 'BAHASA INDONESIA';

    const prompt = `Anda adalah Food Editor dan Culinary Expert profesional untuk aplikasi mobile resep Android.
Tugas Anda adalah MEMOLES, MENSTANDARISASI, dan MENYEMPURNAKAN data resep masakan yang sudah ada berikut menjadi standar editorial tinggi:

Judul Resep: ${title.trim()}
Bahan-Bahan yang Sudah Ada:
${currentIngredients && currentIngredients.trim() ? currentIngredients.trim() : '(Belum ada bahan terstruktur)'}

Langkah Memasak yang Sudah Ada:
${currentDirections && currentDirections.trim() ? currentDirections.trim() : '(Belum ada langkah terstruktur)'}

ATURAN BAHASA MUTLAK (SMART LANGUAGE ALIGNMENT):
- Bahasa asal resep ini terdeteksi sebagai: ${targetLangName}.
- Anda WAJIB menghasilkan seluruh teks output ("summary", "directions", "base_ingredients", dan nama kelompok pada "ingredient_groups") dalam ${targetLangName}.
${isEnglish ? `
* KARENA RESEP ASALNYA BERBAHASA INGGRIS: DILARANG KERAS MENERJEMAHKAN KE BAHASA INDONESIA!
* Tuliskan "summary", "directions", dan "base_ingredients" 100% dalam Bahasa Inggris yang elegan, appetizing, dan memikat pembaca mobile app.
* Format grup bahan: { "name": "For the [component] :", "items": [...] }.
` : `
* KARENA RESEP ASALNYA BERBAHASA INDONESIA: Tuliskan seluruh "summary", "directions", dan "base_ingredients" 100% dalam Bahasa Indonesia yang baku, komunikatif, dan menggugah selera.
* Format grup bahan: { "name": "Untuk [komponen] :", "items": [...] }.
`}
- Pengecualian: Khusus field "t2i_prompt_4_3" SELALU ditulis dalam bahasa Inggris (standar AI food photography prompt).

ATURAN PEMOLESAN & STANDARISASI EDITORIAL:
1. PERTAHANKAN BAHAN ASLI: Pertahankan bahan dan takaran aslinya! Rapikan penulisan takaran tanpa mengurangi bahan penting.
2. PERTAHANKAN LANGKAH ASLI: Pertahankan urutan instruksinya. Poles kalimatnya agar terstruktur, instruktif, dan nyaman dibaca di layar smartphone.
3. BUATKAN "summary": 3-5 kalimat naratif sensory copywriting yang menggugah selera pembaca, mendeskripsikan aroma, tekstur/kerenyahan, profil rasa hidangan, serta tips penyajian atau keunggulan praktisnya.
4. ATURAN PENGELOMPOKAN BAHAN (ADAPTIF):
   - Jika masakan adalah olahan satu kesatuan tanpa saus/komponen terpisah, letakkan SELURUH bahan di dalam "base_ingredients" dan biarkan "ingredient_groups": [].
   - HANYA buat kelompok di "ingredient_groups" jika resep memang memiliki bagian terpisah alami (saus/marinasi/topping/adonan).
5. BUATKAN "t2i_prompt_4_3": Prompt food photography rasio landscape 4:3 yang menampilkan sajian akhir hidangan secara menggoda, fotorealistik, eye-level 45-degree angle, rustic styling, natural appetizing lighting, shallow depth of field --ar 4:3 --stylize 250.

Hasilkan output JSON valid persis dengan struktur berikut:
{
  "recipe_time": "Contoh: 10 mins prep | 20 mins cook",
  "summary": "3-5 kalimat sensory copywriting...",
  "base_ingredients": [
    "item 1...",
    "item 2..."
  ],
  "ingredient_groups": [
    // Kosongkan [] jika resep tidak memiliki komponen terpisah.
    // Jika ada kelompok: { "name": "For the [component] :", "items": ["item A...", "item B..."] }
  ],
  "directions": [
    "Langkah 1 secara terperinci...",
    "Langkah 2 secara terperinci..."
  ],
  "t2i_prompt_4_3": "Award-winning 4:3 food photography of [dish], eye-level 45-degree angle, rustic styling, natural appetizing lighting, shallow depth of field --ar 4:3 --stylize 250"
}`;

    // Resilient AI Engine (Pillar & Multiplier Standard: Waterfall Cascade + Key Pool Rotation)
    const model = await getGeminiModel();
    const res = await model.generateContent(prompt);
    const rawResponse = res.response.text();

    const result = parseGeminiJSON(rawResponse);
    if (!result || typeof result !== 'object') {
      throw new Error('Gagal mem-parsing respon AI sebagai format JSON resep valid.');
    }

    return NextResponse.json({
      success: true,
      data: {
        recipe_time: result.recipe_time || '15 mins prep | 30 mins cook',
        summary: result.summary || '',
        base_ingredients: Array.isArray(result.base_ingredients) ? result.base_ingredients : [],
        ingredient_groups: Array.isArray(result.ingredient_groups) ? result.ingredient_groups : [],
        directions: Array.isArray(result.directions) ? result.directions : [],
        t2i_prompt_4_3: result.t2i_prompt_4_3 || ''
      }
    });
  } catch (err) {
    console.error('[API /api/recipes/auto-enrich Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
