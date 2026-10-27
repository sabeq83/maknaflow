import { NextResponse } from 'next/server';
import { callGeminiWithRetry } from '@/lib/gemini';

export async function POST(req) {
  try {
    const { title, currentIngredients, currentDirections } = await req.json();

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Judul resep wajib diisi.' }, { status: 400 });
    }

    const prompt = `Anda adalah Food Editor dan Culinary Expert profesional untuk aplikasi mobile resep Android.
Tugas Anda adalah memperkaya dan menstandarisasi data resep masakan berikut menjadi standar tinggi:

Judul Resep: ${title.trim()}
Bahan Awal (jika ada): ${currentIngredients || '(Belum terstruktur)'}
Langkah Awal (jika ada): ${currentDirections || '(Belum terstruktur)'}

ATURAN PENGELOMPOKAN BAHAN (PENTING):
- TIDAK SEMUA RESEP MEMILIKI SUB-KELOMPOK! Jangan memaksakan membuat sub-kelompok jika resep sederhana.
- Jika masakan adalah olahan satu kesatuan tanpa saus/komponen terpisah, letakkan SELURUH bahan di dalam "base_ingredients" dan biarkan "ingredient_groups": [].
- HANYA buat kelompok di "ingredient_groups" jika resep memang memiliki bagian terpisah alami, misalnya:
  * Saus / Sambal: "For the sauce :" atau "For the dipping sauce :"
  * Bumbu Marinasi: "For the marinade :"
  * Salad Dressing: "For the dressing :"
  * Adonan / Isian Kue: "For the dough :" atau "For the filling :"
  * Kuah / Kaldu: "For the soup base :" atau "For the broth :"
  * Topping / Garnish: "For the topping :" atau "For the garnish :" (hanya bila benar-benar ada)

Hasilkan output JSON valid persis dengan struktur berikut tanpa teks pembuka/penutup lain:
{
  "recipe_time": "Contoh: 10 mins prep | 25 mins cook",
  "summary": "3-5 kalimat naratif sensory copywriting yang menggugah selera pembaca, mendeskripsikan aroma, kerenyahan, kelembutan rasa, dan keunggulan praktis hidangan ini.",
  "base_ingredients": [
    "item 1...",
    "item 2..."
  ],
  "ingredient_groups": [
    // Kosongkan [] jika resep tidak memiliki komponen terpisah.
    // Jika ada komponen terpisah (marinasi/saus/kuah/adonan/topping), format:
    // { "name": "For the [nama komponen] :", "items": ["item A...", "item B..."] }
  ],
  "directions": [
    "Langkah 1 secara terperinci...",
    "Langkah 2 secara terperinci..."
  ],
  "t2i_prompt_4_3": "Award-winning 4:3 food photography of [dish], eye-level 45-degree angle, rustic styling, natural appetizing lighting, shallow depth of field --ar 4:3 --stylize 250"
}`;

    const rawResponse = await callGeminiWithRetry({
      prompt,
      modelTask: 'RECIPE_CAMPAIGN_CREATIVE',
      temperature: 0.4
    });

    const cleanJson = String(rawResponse || '')
      .replace(/```json\n?|\n?```/g, '')
      .trim();

    let result;
    try {
      result = JSON.parse(cleanJson);
    } catch (e) {
      // Fallback regex extraction jika ada formatting markdown
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Gagal mem-parsing respon AI sebagai format JSON resep valid.');
      }
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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
