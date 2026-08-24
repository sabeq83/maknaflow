import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { validateProductionPlan } from './youtube-studio-contract.js';
import { createKbSnapshot } from './youtube-studio-kb-repository.js';


export async function generateProductionPlan({ episode, script, profile, visualIdentity, universe }) {
  const model = await getGeminiModel();
  const allowedDurations = profile.generatedShotDurations || [8];

  // Resolve bounded KB snapshot for production stage
  let kbContext = '';
  try {
    const kbSnapshot = await createKbSnapshot({ channelId: episode.channel_id, seriesId: episode.series_id, stage: 'production' });
    const kbKeys = Object.keys(kbSnapshot);
    if (kbKeys.length > 0) {
      kbContext = `\n    Knowledge Base Context (visual continuity, prompt grammar — treat as authoritative visual rules):\n    ${JSON.stringify(kbSnapshot, null, 2)}`;
    }
  } catch (_) { /* KB resolution optional */ }

  const prompt = `
    Anda adalah YouTube Video Director. Terjemahkan script voiceover berikut menjadi rencana visual per-shot (Production Plan).
    Setiap scene naratif harus dipecah menjadi satu atau beberapa visual shots untuk menutup durasi voiceover scene tersebut.
    
    Info Episode:
    Judul: "${episode.title}"
    Target Durasi Total: ${episode.target_duration_seconds} detik
    Generation Profile: "${profile.key}" (Allowed durations per generated shot: [${allowedDurations.join(', ')}] detik)
    Visual Identity Context: ${visualIdentity ? JSON.stringify(visualIdentity) : 'None'}
    Universe Context: ${universe ? JSON.stringify(universe) : 'None'}${kbContext}
    
    Script:
    ${JSON.stringify(script.script_json)}

    Ketentuan Pembuatan Rencana:
    1. asset_type harus salah satu dari: generated_visual, broll, diagram, map, text_overlay, archive_style.
    2. Jika asset_type === 'generated_visual', generation_duration_seconds WAJIB salah satu dari [${allowedDurations.join(', ')}].
    3. Jumlah durasi shots dalam satu scene naratif harus sama atau mendekati (selisih max 2 detik) dari estimated_duration_seconds scene tersebut.
    4. prompt harus deskriptif, detail, dan konsisten secara gaya visual mengikuti Visual Identity.

    Output HARUS berupa valid JSON object sesuai skema berikut:
    {
      "generation_profile_key": "${profile.key}",
      "estimated_total_duration_seconds": ${episode.target_duration_seconds},
      "scenes": [
        {
          "scene_index": 1,
          "narrative_duration_seconds": 15,
          "voiceover": "Naskah VO scene ini",
          "shots": [
            {
              "shot_index": 1,
              "asset_type": "generated_visual",
              "generation_duration_seconds": 8,
              "prompt": "Gaya visual dan aksi detil shot ini",
              "transition_to_next": "cut"
            },
            {
              "shot_index": 2,
              "asset_type": "generated_visual",
              "generation_duration_seconds": 8,
              "prompt": "Kelanjutan visual shot kedua",
              "transition_to_next": "cut"
            }
          ],
          "audio_cue": "ambient sound effect"
        }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const parsed = parseGeminiJSON(result.response.text());
  
  if (parsed && Array.isArray(parsed.scenes)) {
    parsed.scenes.forEach((scene, scIdx) => {
      scene.scene_index = scIdx + 1;
      if (Array.isArray(scene.shots)) {
        scene.shots.forEach((shot, shIdx) => {
          shot.shot_index = shIdx + 1;
        });
      }
    });
  }

  return validateProductionPlan(parsed, { profile, episodeDuration: episode.target_duration_seconds });
}
