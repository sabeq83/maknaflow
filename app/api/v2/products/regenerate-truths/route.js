import { NextResponse } from 'next/server';
import { getDb, updateProductExtraction } from '@/lib/db';
import { executeWithKeyPool } from '@/lib/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildBatchProductTruthsPrompt } from '@/lib/prompts';
import { parseGeminiJSON } from '@/lib/json-parser';
import { withTenantContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req) => {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Daftar ID produk wajib dikirim.' }, { status: 400 });
    }

    const db = getDb();
    const productsArray = [];

    // Ambil data produk terpilih dari database SQLite
    for (const id of ids) {
      const p = await db.prepare('SELECT id, product_name, product_description, unique_selling_point, is_in_packaging, packaging_type FROM product_extractions WHERE id = ?').get(id);
      if (p) {
        productsArray.push({
          id: p.id,
          product_name: p.product_name,
          product_description: p.product_description,
          usp: p.unique_selling_point,
          is_in_packaging: p.is_in_packaging === 1,
          packaging_type: p.packaging_type
        });
      }
    }

    if (productsArray.length === 0) {
      return NextResponse.json({ success: false, error: 'Produk tidak ditemukan di database.' }, { status: 404 });
    }

    // Panggil Gemini AI untuk memproses ekstraksi kebenaran produk & geometry
    const promptText = buildBatchProductTruthsPrompt(productsArray);
    const geminiText = await executeWithKeyPool(1, async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              extracted_truths: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    product_truth: { type: 'string' },
                    geometric_truth: { type: 'string' }
                  },
                  required: ['id', 'product_truth', 'geometric_truth']
                }
              }
            },
            required: ['extracted_truths']
          }
        }
      });
      const res = await model.generateContent(promptText);
      return res.response.text();
    });

    const parsed = parseGeminiJSON(geminiText);
    const results = parsed.extracted_truths || [];

    // Simpan hasil ke database SQLite
    let updatedCount = 0;
    for (const item of results) {
      await updateProductExtraction(item.id, {
        product_truth: item.product_truth,
        geometric_truth: item.geometric_truth
      });
      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil men-generate ulang Product Truth & Geometric Truth untuk ${updatedCount} produk.`,
      data: results
    });

  } catch (err) {
    console.error('[Regenerate Truths API Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
