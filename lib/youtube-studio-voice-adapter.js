import { callGeminiTtsApi } from './gemini.js';
import { generateMinimaxVO } from './minimax-tts.js';
import { convertPcmToWav } from './audio-helper.js';
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
  
  // Wrap raw PCM buffer in WAV container to make it play in browsers
  const wavBuffer = convertPcmToWav(buffer, 24000);
  
  fs.writeFileSync(outputPath, wavBuffer);
  return {
    output_path: outputPath,
    size_bytes: wavBuffer.length
  };
}
