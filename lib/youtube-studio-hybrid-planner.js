/**
 * lib/youtube-studio-hybrid-planner.js
 * YouTube Studio Hybrid Planner — Fase 3.5B
 * Generates prompt matrix (T2I/I2V/T2V) for video production.
 */

import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { validateHybridShot, validateProductionPlanByMode } from './youtube-studio-contract.js';

export async function generateHybridPromptMatrix({ episode, script, profile, visualIdentity, universe, kbSnapshot }) {
  const model = await getGeminiModel();
  const allowedDurations = profile?.generatedShotDurations || [8];

  const prompt = `
    Anda adalah AI Video Director & Prompt Engineer untuk YouTube Landscape 16:9.
    Tugas Anda adalah merancang rencana visual per-shot (Prompt Matrix) berdasarkan script voiceover episode YouTube berikut.

    Info Episode:
    Judul: "${episode.title}"
    Locale: "${episode.locale}"
    Target Durasi: ${episode.target_duration_seconds} detik
    Allowed durations per shot: [${allowedDurations.join(', ')}] detik
    Visual Style Profile: ${visualIdentity ? JSON.stringify(visualIdentity) : 'None'}
    Universe Context: ${universe ? JSON.stringify(universe) : 'None'}
    Knowledge Base Snapshot: ${kbSnapshot ? JSON.stringify(kbSnapshot) : 'None'}

    Script Voiceover (VO):
    ${JSON.stringify(script.script_json || script)}

    Ketentuan Pembuatan Rencana Hybrid:
    1. Tentukan generation_mode untuk setiap shot dari: 't2i_i2v', 't2v', 'static_asset', 'broll'.
       - Gunakan 't2i_i2v' jika scene memiliki recurring subject, karakter, atau lokasi spesifik yang membutuhkan kontinuitas visual.
       - Gunakan 't2v' untuk shoot atmospheric/abstract/establishing yang tidak memerlukan aktor/karakter presisi tinggi.
       - Gunakan 'static_asset' untuk bagan/diagram/overlay teks/peta still.
       - Gunakan 'broll' untuk stock footage generic.
    2. Isi field asset_type dan prompt spesifik sesuai mode:
       - Untuk 't2i_i2v' dan 't2v', asset_type WAJIB 'generated_visual'.
       - Untuk 'static_asset', asset_type WAJIB salah satu dari 'diagram', 'map', 'text_overlay', atau 'archive_style'.
       - Untuk 'broll', asset_type WAJIB 'broll'.
       - Jika 't2i_i2v', WAJIB sediakan 't2i_prompt' (untuk start frame) dan 'i2v_prompt' (untuk video movement). Serta berikan deskripsi global di 'prompt'.
       - Jika 't2v', WAJIB sediakan 't2v_prompt'.
       - Untuk 'static_asset' dan 'broll', sediakan spesifikasi di 'prompt' dan kosongkan prompt AI generator lainnya.
    3. Jumlah durasi shots di dalam satu scene naratif harus sama atau mendekati (selisih max 2 detik) dari estimated_duration_seconds scene tersebut.

    Output HARUS berupa valid JSON object sesuai skema berikut:
    {
      "generation_profile_key": "${profile?.key || 'google_flow_omni_flash'}",
      "scenes": [
        {
          "scene_index": 0,
          "voiceover": "naskah narasi scene",
          "narrative_duration_seconds": 16,
          "shots": [
            {
              "shot_index": 0,
              "generation_mode": "t2i_i2v|t2v|static_asset|broll",
              "asset_type": "generated_visual|diagram|map|text_overlay|archive_style|broll",
              "generation_duration_seconds": 8,
              "prompt": "deskripsi visual global shot ini",
              "t2i_prompt": "prompt T2I start-frame (isi jika t2i_i2v)",
              "i2v_prompt": "prompt I2V video movement (isi jika t2i_i2v)",
              "t2v_prompt": "prompt T2V text-to-video (isi jika t2v)",
              "negative_prompt": "negative prompt guidance",
              "continuity_tokens": "continuity tokens/keywords"
            }
          ]
        }
      ]
    }

    Jangan sertakan penjelasan atau markdown formatting di luar JSON.
  `;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text();
  const parsed = parseGeminiJSON(rawText);

  const normalized = normalizeHybridPlan(parsed);

  // Validate plan level properties and shot contracts
  return validateProductionPlanByMode(normalized, {
    profile,
    episode,
    productionMode: 'hybrid'
  });
}

function normalizeHybridPlan(plan) {
  if (!plan?.scenes) return plan;

  return {
    ...plan,
    scenes: plan.scenes.map(scene => ({
      ...scene,
      shots: (scene.shots || []).map(shot => ({
        ...shot,
        asset_type: shot.asset_type || fallbackAssetType(shot.generation_mode)
      }))
    }))
  };
}

function fallbackAssetType(generationMode) {
  if (generationMode === 't2i_i2v' || generationMode === 't2v') return 'generated_visual';
  if (generationMode === 'broll') return 'broll';
  if (generationMode === 'static_asset') return 'text_overlay';
  return null;
}
