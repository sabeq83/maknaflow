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
    1. Seluruh shot visual WAJIB menggunakan generation_mode: 't2i_i2v'.
       - Tidak boleh menggunakan mode 't2v', 'static_asset', atau 'broll'. Semua shot tanpa terkecuali harus berupa 't2i_i2v'.
    2. Isi field asset_type dan prompt spesifik sesuai mode:
       - asset_type WAJIB 'generated_visual' untuk setiap shot.
       - Setiap shot WAJIB menyediakan 't2i_prompt' (untuk start frame) dan 'i2v_prompt' (untuk video movement). Serta berikan deskripsi global di 'prompt'.
       - Kosongkan 't2v_prompt'.
    3. Jumlah durasi shots di dalam satu scene naratif harus sama atau mendekati (selisih max 2 detik) dari estimated_duration_seconds scene tersebut.
    4. prompt harus deskriptif, detail, dan konsisten secara gaya visual mengikuti Visual Identity.
    5. Setiap "t2i_prompt" WAJIB menggunakan satu baris tunggal (single line) tanpa newline dengan template:
       "[SHOT PURPOSE]. Focal subject: [canonical subject description]. Action/pose: [moment]. Environment: [location]. Composition: [framing], 16:9 landscape. Lighting and mood: [direction]. Visual style: [Visual Continuity Guide tokens]."
    6. Setiap "i2v_prompt" WAJIB menggunakan satu baris tunggal (single line) tanpa newline dengan template:
       "Continue from the approved start frame. Primary action: [action]. Camera motion: [motion]. Preserve: [subject identity, wardrobe, composition anchor]. Duration: [duration] seconds, 16:9 landscape."
    7. Daftarkan karakter yang aktif pada shot tersebut di field "subjects" menggunakan key unik dari universe (misal: "cat_detective", "broom_sweeper", dst.) jika terdaftar di Universe Context.

    Output HARUS berupa valid JSON object sesuai skema berikut:
    {
      "generation_profile_key": "${profile?.key || 'google_flow_omni_flash'}",
      "scenes": [
        {
          "scene_index": 1,
          "voiceover": "naskah narasi scene",
          "narrative_duration_seconds": 16,
          "shots": [
            {
              "shot_index": 1,
              "generation_mode": "t2i_i2v|t2v",
              "subjects": ["nama_key_karakter"],
              "asset_type": "generated_visual",
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

  const normalized = normalizeHybridPlan(parsed, allowedDurations);

  // Validate plan level properties and shot contracts
  return validateProductionPlanByMode(normalized, {
    profile,
    episode,
    productionMode: 'hybrid'
  });
}

function roundToNearestAllowed(duration, allowedList) {
  if (!allowedList || allowedList.length === 0) return duration;
  if (allowedList.includes(duration)) return duration;
  let closest = allowedList[0];
  let minDiff = Math.abs(duration - closest);
  for (let i = 1; i < allowedList.length; i++) {
    const diff = Math.abs(duration - allowedList[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = allowedList[i];
    }
  }
  return closest;
}

function normalizeHybridPlan(plan, allowedDurations) {
  if (!plan?.scenes) return plan;

  return {
    ...plan,
    scenes: plan.scenes.map((scene, scIdx) => ({
      ...scene,
      scene_index: scIdx + 1,
      shots: (scene.shots || []).map((shot, shIdx) => {
        const generation_mode = shot.generation_mode || 't2i_i2v';
        const asset_type = shot.asset_type || fallbackAssetType(generation_mode);
        const isAiGenerated = (generation_mode === 't2i_i2v' || generation_mode === 't2v') || (asset_type === 'generated_visual');
        let duration = shot.generation_duration_seconds;
        if (isAiGenerated && duration !== undefined) {
          duration = roundToNearestAllowed(duration, allowedDurations);
        }
        return {
          ...shot,
          shot_index: shIdx + 1,
          asset_type,
          generation_duration_seconds: duration
        };
      })
    }))
  };
}

function fallbackAssetType(generationMode) {
  if (generationMode === 't2i_i2v' || generationMode === 't2v') return 'generated_visual';
  if (generationMode === 'broll') return 'broll';
  if (generationMode === 'static_asset') return 'text_overlay';
  return null;
}
