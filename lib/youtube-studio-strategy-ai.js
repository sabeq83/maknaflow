import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { validateStrategyDraft } from './youtube-studio-contract.js';

export async function generateChannelStrategy({ brief, locale, universe, visualIdentity }) {
  const model = await getGeminiModel();
  
  const prompt = `
    Anda adalah YouTube Channel Strategist Copilot. Hasilkan Channel Strategy Draft berbasis parameter brief berikut.
    Brief: ${JSON.stringify(brief)}
    Locale: "${locale}"
    Universe Context: ${universe ? JSON.stringify(universe) : 'Tidak ada'}
    Visual Identity Context: ${visualIdentity ? JSON.stringify(visualIdentity) : 'Tidak ada'}

    Output HARUS berupa valid JSON object sesuai skema berikut:
    {
      "positioning": "Pernyataan positioning channel yang unik",
      "audience_persona": {
        "who": "Deskripsi target penonton",
        "need": "Masalah utama/kebutuhan yang dipenuhi channel ini",
        "geography": "Geografi target penonton"
      },
      "content_pillars": [
        {
          "name": "Nama Pilar Konten",
          "purpose": "Tujuan pilar konten ini",
          "example_angles": ["Contoh angle 1", "Contoh angle 2"]
        }
      ],
      "editorial_tone": "Karakter bahasa/editorial tone",
      "video_format": {
        "target_duration_seconds": 600,
        "cadence": "weekly"
      },
      "monetization_path": ["adsense"],
      "cta_strategy": "Strategi Call to Action utama",
      "risk_guardrails": ["Batasan konten/kebijakan risiko"]
    }
  `;

  const result = await model.generateContent(prompt);
  const parsed = parseGeminiJSON(result.response.text());
  return validateStrategyDraft(parsed);
}

export async function refineChannelStrategy({ currentDraft, instruction, locale }) {
  const model = await getGeminiModel();

  const prompt = `
    Anda adalah YouTube Channel Strategist Copilot. Perbaiki Channel Strategy Draft saat ini berdasarkan instruksi dari pengguna.
    Current Strategy Draft: ${JSON.stringify(currentDraft)}
    User Request/Instruction: "${instruction}"
    Locale: "${locale}"

    Kembalikan output JSON penuh dengan format yang sama persis seperti schema sebelumnya.
  `;

  const result = await model.generateContent(prompt);
  const parsed = parseGeminiJSON(result.response.text());
  return validateStrategyDraft(parsed);
}
