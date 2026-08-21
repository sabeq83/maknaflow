import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { resolveEpisodeDuration } from './youtube-studio-contract.js';

export async function generateEpisodeIdeas(channel, strategy, series, count = 3, locale = 'id-ID') {
  const model = await getGeminiModel();
  
  const resolved = resolveEpisodeDuration({
    channelStrategy: strategy,
    series: series
  });
  const targetDuration = resolved.target_duration_seconds;
  
  const prompt = `
    Anda adalah AI Channel Producer & Backlog Planner. Hasilkan ide episode baru untuk series berikut:
    Channel Name: "${channel.name}"
    Channel Niche/Strategy: "${strategy?.brief_json?.niche || ''}" / "${strategy?.config_json?.positioning || ''}"
    Series Name: "${series.name}"
    Series Pillar/Config: "${series.pillar || ''}" / ${JSON.stringify(series.config_json || {})}
    Locale: "${locale}"
    Target Count: ${count} ide episode.
    Target Duration: ${targetDuration} detik.

    Output HARUS berupa valid JSON array of objects dengan format:
    [
      {
        "title": "Judul Episode Menarik & SEO-Friendly",
        "angle": "Sudut pandang/angle unik yang diangkat",
        "content_promise": "Janji konten/apa yang didapat penonton",
        "rationale": "Alasan mengapa topik ini relevan dengan target penonton",
        "target_duration_seconds": ${targetDuration}
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
