import { NextResponse } from 'next/server';
import { executeWithKeyPool } from '@/lib/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || file.size === 0) {
      return NextResponse.json({ success: false, error: 'File wajib diunggah.' }, { status: 400 });
    }

    // Read file content as text
    const buffer = Buffer.from(await file.arrayBuffer());
    let rawText = '';

    const filename = file.name.toLowerCase();
    if (filename.endsWith('.pdf')) {
      // Dynamic import pdf-parse only when needed
      try {
        const reqFunc = eval('require');
        const pdfParse = reqFunc('pdf-parse');
        const pdfData = await pdfParse(buffer);
        rawText = pdfData.text;
      } catch (e) {
        // Fallback: read as utf-8 text
        rawText = buffer.toString('utf-8');
      }
    } else {
      // .md, .txt, .docx (plain text fallback)
      rawText = buffer.toString('utf-8');
    }

    if (!rawText || rawText.trim().length < 20) {
      return NextResponse.json({ success: false, error: 'File terlalu pendek atau tidak dapat dibaca.' }, { status: 400 });
    }

    // Use Gemini to extract structured brand data
    const extractionPrompt = `Kamu adalah AI yang bertugas mengekstrak informasi Brand Identity dari dokumen Brand Guideline berikut.

[DOKUMEN BRAND GUIDELINE]
${rawText.substring(0, 15000)}

[TUGAS]
Baca dokumen di atas dengan cermat, lalu ekstrak informasi berikut ke dalam format JSON.
Jika suatu field tidak ditemukan secara eksplisit dalam dokumen, buatlah interpretasi terbaik berdasarkan konteks keseluruhan dokumen.

[OUTPUT FORMAT - STRICT JSON]
{
  "brand_name": "Nama brand/merek yang disebutkan",
  "tone_of_voice": "Pilih salah satu yang paling cocok: Kasual/Gaul | Profesional/Edukatif | ASMR/Menenangkan | Motivasi/Tegas",
  "visual_signature": "Deskripsi gaya visual brand (pencahayaan, sudut kamera, estetika, dll)",
  "color_palette": "Palet warna utama brand (misal: warm beige, sage green, soft white)",
  "forbidden_elements": "Elemen-elemen yang dilarang/tidak sesuai brand (jika disebutkan)",
  "brand_slogan_or_cta": "Slogan atau CTA utama brand (jika ada)"
}`;

    const responseText = await executeWithKeyPool(1, async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        }
      });
      const result = await model.generateContent(extractionPrompt);
      return result.response.text();
    });

    let extracted;
    try {
      const cleanJson = responseText.replace(/^\s*```(json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      extracted = JSON.parse(cleanJson);
    } catch (e) {
      return NextResponse.json({ success: false, error: 'AI gagal mengekstrak data: ' + e.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...extracted,
        raw_guideline_text: rawText,
        guideline_filename: file.name,
      }
    });
  } catch (error) {
    console.error('Brand Extract Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
