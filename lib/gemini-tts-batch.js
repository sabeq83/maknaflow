import { convertPcmToWav } from './audio-helper.js';
import { executeWithKeyPool } from './gemini.js';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);

/**
 * Membentuk prompt gabungan untuk TTS massal
 * @param {string[]} texts - Array naskah per klip
 * @returns {string} Prompt gabungan
 */
export function buildCombinedTtsPrompt(texts) {
  let prompt = "Please read the following Indonesian texts one by one in order. You MUST insert a pause of exactly 3.0 seconds of complete silence between each text segment. Do not speak any segment headers, instructions, numbers, quotes, or intro/outro words. Only speak the exact Indonesian text content inside the quotes for each segment. Read each segment according to its speed instruction so that the spoken part of each segment takes exactly 8.0 seconds of audio duration:\n\n";
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i].trim();
    const wordCount = text.split(/\s+/).length;
    let pacingInstruction = "";
    if (wordCount < 16) {
      pacingInstruction = "read at a slow, deliberate pace with pauses between words to take exactly 8.0 seconds";
    } else if (wordCount >= 16 && wordCount <= 22) {
      pacingInstruction = "read at a normal, clear pace to take exactly 8.0 seconds";
    } else {
      pacingInstruction = "read at an upbeat, energetic, and rapid promotional pace to fit into exactly 8.0 seconds";
    }
    prompt += `Segment ${i + 1} (${pacingInstruction}): "${text}"\n`;
  }
  return prompt;
}

/**
 * Menghasilkan audio segmen terpisah dengan 1x panggilan API Gemini dan splitting via FFmpeg
 * @param {string[]} texts - Array naskah per klip
 * @param {string} voicePersona - Karakter Suara Gemini
 * @param {string[]} outputPaths - Array path lokal tujuan penyimpanan tiap segmen
 * @returns {Promise<boolean>} Mengembalikan true jika sukses, melempar error jika gagal (agar terpicu fallback)
 */
export async function generateGeminiBatchTTS(texts, voicePersona, outputPaths) {
  if (!texts || texts.length === 0) {
    throw new Error('Naskah kosong.');
  }
  if (texts.length !== outputPaths.length) {
    throw new Error('Jumlah naskah tidak sesuai dengan jumlah path output.');
  }

  // Jika hanya ada 1 naskah, langsung bypass ke individual mode (tidak butuh split)
  if (texts.length === 1) {
    throw new Error('Hanya 1 klip, lewati batch mode.');
  }

  const combinedPrompt = buildCombinedTtsPrompt(texts);
  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const combinedWavPath = path.join(tempDir, `combined_tts_${Date.now()}.wav`);

  console.log(`[Gemini-Batch-TTS] Mengirim permintaan batch untuk ${texts.length} klip...`);

  await executeWithKeyPool(1, async (apiKey) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
    const payload = {  
      contents: [  
        {  
          parts: [  
            {  
              text: combinedPrompt  
            }  
          ]  
        }  
      ],  
      generationConfig: {  
        responseModalities: ["AUDIO"],  
        speechConfig: {  
          voiceConfig: {  
            prebuiltVoiceConfig: {  
              voiceName: voicePersona || "Kore"   
            }  
          }  
        }  
      }  
    };

    const response = await fetch(url, {  
      method: "POST",  
      headers: { "Content-Type": "application/json" },  
      body: JSON.stringify(payload)  
    });

    if (!response.ok) {  
      const errorText = await response.text();
      throw new Error(`Gemini API HTTP Error: ${response.status} - ${errorText}`);  
    }

    const result = await response.json();  
    const base64Pcm = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;  
    if (!base64Pcm) {  
      throw new Error("Gagal mengambil data audio biner dari respon Gemini.");  
    }

    const pcmBuffer = Buffer.from(base64Pcm, 'base64');  
    const wavBuffer = convertPcmToWav(pcmBuffer, 24000); // 24kHz output format

    fs.writeFileSync(combinedWavPath, wavBuffer);
  });

  try {
    // Jalankan deteksi keheningan menggunakan FFmpeg
    // d=2.0 mendeteksi hening yang berdurasi minimal 2.0 detik (target kita 3.0 detik jeda)
    const { stderr } = await execPromise(`ffmpeg -i "${combinedWavPath}" -af silencedetect=noise=-40dB:d=2.0 -f null -`);

    // Cari total durasi dari log FFmpeg untuk mendeteksi hening di akhir file
    const durationMatch = stderr.match(/Duration:\s+(\d+):(\d+):([\d.]+)/);
    let totalDuration = 0;
    if (durationMatch) {
      const hrs = parseInt(durationMatch[1]);
      const mins = parseInt(durationMatch[2]);
      const secs = parseFloat(durationMatch[3]);
      totalDuration = hrs * 3600 + mins * 60 + secs;
      console.log(`[Gemini-Batch-TTS] Total durasi file gabungan: ${totalDuration.toFixed(2)} detik`);
    }

    const lines = stderr.split('\n');
    const silenceIntervals = [];
    
    for (const line of lines) {
      if (line.includes('silence_start:')) {
        const matchStart = line.match(/silence_start:\s+([\d.]+)/);
        if (matchStart) {
          silenceIntervals.push({ start: parseFloat(matchStart[1]) });
        }
      } else if (line.includes('silence_end:')) {
        const matchEnd = line.match(/silence_end:\s+([\d.]+)/);
        if (matchEnd && silenceIntervals.length > 0) {
          silenceIntervals[silenceIntervals.length - 1].end = parseFloat(matchEnd[1]);
        }
      }
    }

    console.log('[Gemini-Batch-TTS] Raw silence intervals:', JSON.stringify(silenceIntervals));

    // Saring keheningan palsu di awal (prefix) dan akhir (suffix) audio
    const validIntervals = silenceIntervals.filter(interval => {
      if (interval.start === undefined || interval.end === undefined) return false;
      
      // Keheningan di awal (biasanya < 1.0 detik setelah audio mulai)
      if (interval.start < 1.0) {
        console.log(`[Gemini-Batch-TTS] Mengabaikan hening awalan (prefix): ${interval.start.toFixed(2)}s - ${interval.end.toFixed(2)}s`);
        return false;
      }
      
      // Keheningan di akhir (biasanya mulai < 7.5 detik dari akhir file karena target jeda kita 3.0 detik dan segment 3 mengambil waktu baca)
      if (totalDuration > 0 && (totalDuration - interval.start) < 7.5) {
        console.log(`[Gemini-Batch-TTS] Mengabaikan hening akhiran (suffix): ${interval.start.toFixed(2)}s - ${interval.end.toFixed(2)}s`);
        return false;
      }
      
      return true;
    });

    const expectedSilences = texts.length - 1;
    let finalIntervals = validIntervals;
    if (finalIntervals.length > expectedSilences) {
      console.log(`[Gemini-Batch-TTS] Menyeleksi ${expectedSilences} hening pertama dari ${finalIntervals.length} hening terdeteksi.`);
      finalIntervals = finalIntervals.slice(0, expectedSilences);
    }

    console.log(`[Gemini-Batch-TTS] Terdeteksi hening jeda utama: ${finalIntervals.length} (Diharapkan: ${expectedSilences})`);

    if (finalIntervals.length !== expectedSilences) {
      throw new Error(`Deteksi hening jeda utama tidak cocok. Terdeteksi ${finalIntervals.length}, diharapkan ${expectedSilences}. Menjalankan fallback individual.`);
    }

    // Hitung titik potong (midpoint) dari keheningan
    const midpoints = finalIntervals.map(interval => (interval.start + interval.end) / 2);

    // Lakukan pemotongan (split) audio per segmen
    for (let i = 0; i < texts.length; i++) {
      const start = i === 0 ? 0 : midpoints[i - 1];
      const end = i === texts.length - 1 ? null : midpoints[i];
      const outputWav = outputPaths[i];

      let splitCmd = `ffmpeg -y -ss ${start.toFixed(3)}`;
      if (end !== null) {
        splitCmd += ` -to ${end.toFixed(3)}`;
      }
      splitCmd += ` -i "${combinedWavPath}" -c copy "${outputWav}"`;

      await execPromise(splitCmd);
      console.log(`[Gemini-Batch-TTS] Berhasil memotong klip #${i+1} ke: ${outputWav}`);
    }

    // Bersihkan file gabungan sementara
    try {
      if (fs.existsSync(combinedWavPath)) {
        fs.unlinkSync(combinedWavPath);
      }
    } catch (_) {}

    return true;
  } catch (err) {
    // Bersihkan file gabungan sementara jika terjadi error
    try {
      if (fs.existsSync(combinedWavPath)) {
        fs.unlinkSync(combinedWavPath);
      }
    } catch (_) {}
    throw err;
  }
}
