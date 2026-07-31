import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { createProductExtraction, getAllProductExtractions, getAllKnowledgeBasesWithContent } from '@/lib/db';
import { getGeminiModel } from '@/lib/gemini';
import { buildProductAgentPrompt } from '@/lib/prompts';
import { scrapeUrl } from '@/lib/url-scraper';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const { input_source, is_url } = await request.json();

    if (!input_source || !input_source.trim()) {
      return NextResponse.json({ success: false, error: 'Input source wajib diisi' }, { status: 400 });
    }

    let sourceContent = input_source;

    // If URL, scrape the content first
    if (is_url) {
      try {
        const scraped = await scrapeUrl(input_source);
        sourceContent = scraped.fullText;
      } catch (scrapeError) {
        return NextResponse.json({ 
          success: false, 
          error: `Gagal scrape URL: ${scrapeError.message}` 
        }, { status: 400 });
      }
    }

    // Build prompt and call Gemini
    const prompt = buildProductAgentPrompt(sourceContent, is_url);
    const model = await getGeminiModel();
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let parsed;
    try {
      parsed = parseGeminiJSON(responseText);
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: 'Gagal mem-parsing respons Gemini. Coba lagi.',
      }, { status: 500 });
    }

    const productData = parsed.product_data || parsed;

    // Save to DB
    const data = {
      id: uuidv4(),
      input_source: input_source,
      is_url: is_url ? 1 : 0,
      product_name: productData.product_name || '',
      product_description: productData.product_description || '',
      unique_selling_point: productData.unique_selling_point || '',
      target_audience: productData.target_audience || '',
      pain_point_solved: productData.pain_point_solved || '',
      key_visuals_extracted: JSON.stringify(productData.key_visuals_extracted || []),
      raw_response: responseText,
    };

    await createProductExtraction(data);

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        key_visuals_extracted: productData.key_visuals_extracted || [],
      },
    });
  } catch (error) {
    console.error('Product Agent error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const products = await getAllProductExtractions();
    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
// Force recompile after prompts.js fix
