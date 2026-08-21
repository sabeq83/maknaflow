import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';

export async function generateEpisodeIdeas({ strategy, series, locale, count = 5 }) {
  const model = await getGeminiModel();

  const prompt = `
    Anda adalah YouTube Content Strategist. Hasilkan daftar saran ide backlog episode berkualitas tinggi.
    Channel Strategy: ${JSON.stringify(strategy.config_json)}
    Series Name: "${series.name}"
    Series Pillar/Config: "${series.pillar || ''}" / ${JSON.stringify(series.config_json || {})}
    Locale: "${locale}"
    Target Count: ${count} ide episode.

    Output HARUS berupa valid JSON array of objects dengan format:
    [
      {
        "title": "Judul Episode Menarik & SEO-Friendly",
        "angle": "Sudut pandang/angle unik yang diangkat",
        "content_promise": "Janji konten/apa yang didapat penonton",
        "rationale": "Alasan mengapa topik ini relevan dengan target penonton",
        "target_duration_seconds": 600
      }
    ]
  `;

  const result = await model.generateContent(prompt);
  const parsed = parseGeminiJSON(result.response.text());
  
  if (!Array.isArray(parsed)) {
    throw new Error('AI output is not a valid JSON array');
  }
  return parsed;
}
