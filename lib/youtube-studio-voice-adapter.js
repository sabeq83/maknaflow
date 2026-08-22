import { callGeminiTtsApi } from './gemini.js';
import fs from 'fs';

export async function generateVoiceSegment({ text, locale, persona = 'Orus', outputPath }) {
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
