import { callGeminiTtsApi } from './gemini.js';
import { generateMinimaxVO } from './minimax-tts.js';
import fs from 'fs';

export async function generateVoiceSegment({ text, locale, provider = 'google_tts', persona = 'Orus', outputPath }) {
  if (provider === 'minimax') {
    const resPath = await generateMinimaxVO(text, persona, outputPath, { language: locale });
    const stats = fs.statSync(resPath);
    return {
      output_path: resPath,
      size_bytes: stats.size
    };
  }

  // Fallback to Google Gemini TTS
  const buffer = await callGeminiTtsApi(text, persona);
  if (!buffer || buffer.length === 0) {
    throw new Error('Gemini TTS returned empty audio buffer');
  }
  fs.writeFileSync(outputPath, buffer);
  return {
    output_path: outputPath,
    size_bytes: buffer.length
  };
}
