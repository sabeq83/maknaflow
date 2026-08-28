import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { validateResearchBrief, validateBlueprint, validateSceneScript, validateSeriesConcept } from './youtube-studio-contract.js';
import { createKbSnapshot } from './youtube-studio-kb-repository.js';

export async function generateResearchBrief(episode, strategy, universe, visualIdentity, resolvedNarrative) {
  const model = await getGeminiModel();

  // Resolve bounded KB snapshot for research stage
  let kbContext = '';
  try {
    const kbSnapshot = await createKbSnapshot({ channelId: episode.channel_id, seriesId: episode.series_id, stage: 'blueprint' });
    const kbKeys = Object.keys(kbSnapshot);
    if (kbKeys.length > 0) {
      kbContext = `\n    Knowledge Base Context (use as authoritative guidance, do not override with ad-hoc assumptions):\n    ${JSON.stringify(kbSnapshot, null, 2)}`;
    }
  } catch (_) { /* KB resolution optional — planner still works without KB */ }

  const narrativePromptContext = resolvedNarrative ? `
    Narrative Settings & Cast (Authoritative Configuration):
    - Mode: ${resolvedNarrative.resolved_mode}
    - POV: ${resolvedNarrative.point_of_view}
    - Narrator Usage: ${resolvedNarrative.narrator_usage}
    - Max Speakers Per Scene: ${resolvedNarrative.max_speakers_per_scene}
    - Dialogue Ratio Target: ${resolvedNarrative.dialogue_ratio.target} (Min: ${resolvedNarrative.dialogue_ratio.min}, Max: ${resolvedNarrative.dialogue_ratio.max})
    - Cast Members: ${JSON.stringify(resolvedNarrative.speakers)}
    - Dialogue Guardrails: ${JSON.stringify(resolvedNarrative.guardrails)}
  ` : '';

  const prompt = `
    Anda adalah AI Video Researcher. Hasilkan Research Brief detail untuk episode YouTube Landscape 16:9 berikut.
    Judul: "${episode.title}"
    Locale: "${episode.locale}"
    Niche: "${strategy?.brief_json?.niche || 'General'}"
    Audience Strategy: "${strategy?.brief_json?.audience || 'General audience'}"
    Universe Context: ${universe ? JSON.stringify(universe) : 'None'}
    Visual Style Profile: ${visualIdentity ? JSON.stringify(visualIdentity) : 'None'}${kbContext}${narrativePromptContext}
    
    Language/Bahasa: Seluruh teks dalam field JSON (seperti "episode_angle", "audience_intent", "viewer_questions", "keyword_cluster", "key_claims.claim", "editorial_risks", "recommended_structure", "source_requests", "narrative_research") WAJIB ditulis dalam bahasa yang sesuai dengan Locale ("${episode.locale}").
    - Jika locale adalah "en-US", tulis seluruh teks dalam Bahasa Inggris.
    - Jika locale adalah "id-ID", tulis dalam Bahasa Indonesia.

    Ketentuan Faktual & Narasi:
    - Identifikasi "conflict_opportunities" dramatis untuk percakapan karakter.
    - Buat "character_knowledge_map" yang menjelaskan informasi apa yang diketahui/tidak diketahui oleh masing-masing pembicara/karakter.
    - Cantumkan "dialogue_risk_flags" untuk memastikan fakta penting tidak diucapkan secara asal-asalan oleh karakter.

    Format output wajib JSON dengan skema tepat berikut:
    {
      "episode_angle": "string deskripsi angle unik",
      "audience_intent": "string mengapa penonton ingin melihat video ini",
      "viewer_questions": ["array pertanyaan utama penonton"],
      "keyword_cluster": ["array kata kunci utama"],
      "key_claims": [{ "claim": "klaim/fakta utama", "risk": "low|medium|high", "source_note": "catatan validasi sumber" }],
      "editorial_risks": ["array resiko misinformasi/sensitif"],
      "recommended_structure": "string rekomendasi alur video",
      "source_requests": ["sumber data yang perlu divalidasi"],
      "narrative_research": {
        "recommended_mode": "${resolvedNarrative?.resolved_mode || 'hybrid_narration_dialogue'}",
        "conflict_opportunities": ["string opportunities"],
        "character_knowledge_map": [
          {
            "speaker_id": "string speaker_id dari cast",
            "knows": ["string info"],
            "does_not_know": ["string info"]
          }
        ],
        "dialogue_risk_flags": ["string risk warnings"]
      }
    }
  `;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text();
  const parsed = parseGeminiJSON(rawText);
  return validateResearchBrief(parsed);
}

export async function generateBlueprint(episode, strategy, researchBrief, universe, visualIdentity, resolvedNarrative) {
  const model = await getGeminiModel();

  // Resolve bounded KB snapshot for blueprint stage
  let kbContext = '';
  try {
    const kbSnapshot = await createKbSnapshot({ channelId: episode.channel_id, seriesId: episode.series_id, stage: 'blueprint' });
    const kbSnapshotKeys = Object.keys(kbSnapshot);
    if (kbSnapshotKeys.length > 0) {
      kbContext = `\n    Knowledge Base Context (editorial playbook, content guide — treat as authoritative):\n    ${JSON.stringify(kbSnapshot, null, 2)}`;
    }
  } catch (_) { /* KB resolution optional */ }

  const narrativePromptContext = resolvedNarrative ? `
    Narrative Settings & Cast (Authoritative Configuration):
    - Mode: ${resolvedNarrative.resolved_mode}
    - POV: ${resolvedNarrative.point_of_view}
    - Narrator Usage: ${resolvedNarrative.narrator_usage}
    - Max Speakers Per Scene: ${resolvedNarrative.max_speakers_per_scene}
    - Cast Members: ${JSON.stringify(resolvedNarrative.speakers)}
    - Narrative Research Context: ${JSON.stringify(researchBrief.narrative_research || {})}
  ` : '';

  const prompt = `
    Anda adalah YouTube Video Architect. Buat Video Blueprint dengan chapter timing detail.
    Judul: "${episode.title}"
    Locale: "${episode.locale}"
    Target Duration: ${episode.target_duration_seconds} detik.
    Research Angle: "${researchBrief.episode_angle}"
    Content Pillars: ${strategy?.config_json?.content_pillars ? JSON.stringify(strategy.config_json.content_pillars) : 'None'}
    Universe Context: ${universe ? JSON.stringify(universe) : 'None'}
    Visual Style: ${visualIdentity ? JSON.stringify(visualIdentity) : 'None'}${kbContext}${narrativePromptContext}

    Language/Bahasa: Seluruh teks dalam field JSON (seperti "content_promise", "hook.text", "chapters.title", "chapters.narrative_focus", "cta.text", "next_video_bridge") WAJIB ditulis dalam bahasa yang sesuai dengan Locale ("${episode.locale}").
    - Jika locale adalah "en-US", tulis seluruh teks dalam Bahasa Inggris yang natural.
    - Jika locale adalah "id-ID", tulis dalam Bahasa Indonesia.

    Ketentuan Narasi Hibrida/Dialog:
    - Untuk setiap chapter, tentukan struktur "narrative_plan".
    - Sertakan "mode" (e.g. dialogue_with_narrator_bridge, monologue, dll) untuk chapter tersebut.
    - Tentukan "narrator_function" (apa tugas narator di chapter ini).
    - Tulis rencana "dialogue_beats" yang merinci tujuan dialog, karakter yang berbicara, konflik, info yang diungkap/disembunyikan, dan pergeseran emosi.

    Format output wajib JSON dengan skema tepat berikut:
    {
      "content_promise": "janji utama video dalam 5 detik pertama",
      "hook": { "text": "naskah hook awal video", "target_duration_seconds": 30 },
      "chapters": [
        {
          "order": 1,
          "title": "judul chapter",
          "target_duration_seconds": 90,
          "narrative_focus": "alur narasi utama chapter ini",
          "retention_moment": "bagaimana menjaga perhatian penonton di chapter ini",
          "pattern_interrupt": "visual/audio interrupt yang digunakan",
          "narrative_plan": {
            "mode": "dialogue_with_narrator_bridge|monologue|pure_dialogue",
            "narrator_function": "fungsi narrator di chapter ini",
            "dialogue_beats": [
              {
                "beat_order": 1,
                "purpose": "tujuan dialog beat ini",
                "speakers": ["array speaker_id dari cast"],
                "conflict": "konflik/tensitas beat",
                "information_revealed": "info yang terbuka",
                "information_withheld": "info yang disimpan/disembunyikan",
                "emotional_shift": "controlled -> defensive"
              }
            ]
          }
        }
      ],
      "cta": { "text": "ajakan CTA di akhir video", "placement": "outro" },
      "next_video_bridge": "rekomendasi video berikutnya untuk loops view"
    }
  `;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text();
  const parsed = parseGeminiJSON(rawText);
  return validateBlueprint(parsed, episode.target_duration_seconds);
}

import { getNarrationProfile, calculateNarrationBudget, allocateSceneBudgets } from './youtube-studio-narration-profiles.js';

export async function generateScript(episode, blueprint, researchBrief, universe, visualIdentity, resolvedNarrative) {
  const model = await getGeminiModel();

  const profileKey = episode.narration_profile_key || 'general_id';
  const profile = getNarrationProfile(profileKey);
  const budget = calculateNarrationBudget({ targetSeconds: episode.target_duration_seconds, profile });
  const scenesWithBudgets = [];
  if (blueprint.hook) {
    scenesWithBudgets.push({ estimated_duration_seconds: blueprint.hook.target_duration_seconds || 30 });
  }
  if (blueprint.chapters) {
    for (const c of blueprint.chapters) {
      scenesWithBudgets.push({ estimated_duration_seconds: c.target_duration_seconds });
    }
  }
  const sceneBudgets = allocateSceneBudgets({ scenes: scenesWithBudgets, budget, profile });

  const narrativePromptContext = resolvedNarrative ? `
    Narrative Settings & Cast (Authoritative Configuration):
    - Mode: ${resolvedNarrative.resolved_mode}
    - POV: ${resolvedNarrative.point_of_view}
    - Narrator Usage: ${resolvedNarrative.narrator_usage}
    - Max Speakers Per Scene: ${resolvedNarrative.max_speakers_per_scene}
    - Cast Members: ${JSON.stringify(resolvedNarrative.speakers)}
  ` : '';

  const prompt = `
    Anda adalah Storyteller & Scriptwriter YouTube profesional. Tulis naskah scene-by-scene lengkap versi Script v2 (multi-speaker).
    Judul: "${episode.title}"
    Locale: "${episode.locale}"
    Target Duration: ${episode.target_duration_seconds} detik.
    Blueprint: ${JSON.stringify(blueprint)}
    Research Claims: ${JSON.stringify(researchBrief?.key_claims || [])}
    Visual Style Profile: ${visualIdentity ? JSON.stringify(visualIdentity) : 'None'}
    Universe Context: ${universe ? JSON.stringify(universe) : 'None'}
    Narration Profile: ${profileKey} (WPM: ${profile.targetWpm}, Pause Ratio: ${profile.pauseRatio})
    ${narrativePromptContext}

    Ketentuan naskah & Pacing:
    - Bahasa Penulisan: Seluruh teks "text" di dalam audio_blocks dan "subtitle_cue" WAJIB ditulis dalam bahasa yang sesuai dengan Locale ("${episode.locale}"). Jika locale adalah "en-US", tulis dalam Bahasa Inggris. Jika locale adalah "id-ID", tulis dalam Bahasa Indonesia. Bidang deskriptif seperti visual_direction, purpose, transition_note, atau audio_cue boleh ditulis dalam Bahasa Inggris/Indonesia.
    - scene_type harus salah satu dari: generated_visual, broll, diagram, map, text_overlay, archive_style.
    - Naskah ini adalah Script v2 yang menggunakan struktur "audio_blocks" menggantikan "voiceover" di level scene.
    - Setiap audio block harus memiliki: block_id unik, order, type (narration|dialogue|internal_monologue), speaker_id (mesti terdaftar di cast), text, emotion, delivery, dan pause_before_ms/pause_after_ms.
    - AI dilarang keras menciptakan speaker_id baru di luar cast terdaftar.
    - Total kata harus berada di kisaran ${budget.min} sampai ${budget.max} kata (Ideal: ${budget.ideal} kata).

    Format output wajib JSON dengan skema tepat berikut:
    {
      "schema_version": 2,
      "title": "judul naskah",
      "narrative_mode": "${resolvedNarrative?.resolved_mode || 'hybrid_narration_dialogue'}",
      "estimated_total_duration_seconds": ${episode.target_duration_seconds},
      "speaker_manifest": ${JSON.stringify(resolvedNarrative?.speakers || [])},
      "scenes": [
        {
          "scene_index": 1,
          "chapter_order": 1,
          "purpose": "tujuan scene ini",
          "estimated_duration_seconds": 15,
          "scene_type": "generated_visual|broll|diagram|map|text_overlay|archive_style",
          "location_key": "string lokasi",
          "present_characters": ["array speaker_id"],
          "audio_blocks": [
            {
              "block_id": "sc01_ab01",
              "order": 1,
              "type": "narration",
              "speaker_id": "narrator",
              "text": "Teks yang dibaca narator",
              "emotion": "neutral",
              "delivery": "standard",
              "pause_before_ms": 0,
              "pause_after_ms": 500,
              "estimated_duration_seconds": 5.2,
              "subtitle_cue": "Teks subtitle cue",
              "visual_beat_id": "sc01_vb01"
            },
            {
              "block_id": "sc01_ab02",
              "order": 2,
              "type": "dialogue",
              "speaker_id": "detective_arya",
              "text": "Teks dialog karakter",
              "emotion": "suspicious",
              "delivery": "quiet_restrained",
              "pause_before_ms": 250,
              "pause_after_ms": 400,
              "estimated_duration_seconds": 3.5,
              "subtitle_cue": "Teks subtitle cue",
              "visual_beat_id": "sc01_vb02"
            }
          ],
          "visual_direction": "panduan visual scene",
          "transition_note": "transisi (e.g. cut, fade)",
          "music_cue": "efek suara / musik latar",
          "sfx_cues": ["array sfx cues"]
        }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text();
  const parsed = parseGeminiJSON(rawText);
  return validateSceneScript(parsed, blueprint, episode.target_duration_seconds);
}

export async function generateSeriesConcepts(channel, strategy) {
  const model = await getGeminiModel();
  
  const prompt = `
    Anda adalah AI Showrunner & TV Executive. Hasilkan tepat 3 konsep Content Series YouTube Landscape 16:9 yang cocok dengan strategi channel berikut:
    Channel Name: "${channel.name}"
    Locale: "${channel.primary_locale}"
    Niche: "${strategy?.brief_json?.niche || 'General'}"
    Strategy Positioning: "${strategy?.config_json?.positioning}"
    Content Pillars: ${JSON.stringify(strategy?.config_json?.content_pillars || [])}

    Setiap konsep harus unik, spesifik, dan memicu ketertarikan tinggi dari target penonton.

    Language/Bahasa: Seluruh teks dalam field JSON ("name", "description", "concept_angle") WAJIB ditulis dalam bahasa yang sesuai dengan Locale ("${channel.primary_locale}").
    - Jika locale adalah "en-US", tulis seluruh teks dalam Bahasa Inggris yang alami dan menarik.
    - Jika locale adalah "id-ID", tulis dalam Bahasa Indonesia.
    
    Format output wajib JSON dengan skema tepat berikut:
    {
      "concepts": [
        {
          "name": "nama series (singkat dan menarik)",
          "pillar": "pilih salah satu nama content pillar yang cocok dari daftar strategy",
          "description": "deskripsi singkat konsep series dan mengapa konsep ini menarik bagi penonton",
          "concept_angle": "angle cerita/narasi unik series ini"
        }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text();
  const parsed = parseGeminiJSON(rawText);
  return validateSeriesConcept(parsed);
}
