import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { validateResearchBrief, validateBlueprint, validateSceneScript, validateSeriesConcept } from './youtube-studio-contract.js';
import { createKbSnapshot } from './youtube-studio-kb-repository.js';


export async function generateResearchBrief(episode, strategy, universe, visualIdentity) {
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

  const prompt = `
    Anda adalah AI Video Researcher. Hasilkan Research Brief detail untuk episode YouTube Landscape 16:9 berikut.
    Judul: "${episode.title}"
    Locale: "${episode.locale}"
    Niche: "${strategy?.brief_json?.niche || 'General'}"
    Audience Strategy: "${strategy?.brief_json?.audience || 'General audience'}"
    Universe Context: ${universe ? JSON.stringify(universe) : 'None'}
    Visual Style Profile: ${visualIdentity ? JSON.stringify(visualIdentity) : 'None'}${kbContext}
    
    Format output wajib JSON dengan skema tepat berikut:
    {
      "episode_angle": "string deskripsi angle unik",
      "audience_intent": "string mengapa penonton ingin melihat video ini",
      "viewer_questions": ["array pertanyaan utama penonton"],
      "keyword_cluster": ["array kata kunci utama"],
      "key_claims": [{ "claim": "klaim/fakta utama", "risk": "low|medium|high", "source_note": "catatan validasi sumber" }],
      "editorial_risks": ["array resiko misinformasi/sensitif"],
      "recommended_structure": "string rekomendasi alur video",
      "source_requests": ["sumber data yang perlu divalidasi"]
    }
  `;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text();
  const parsed = parseGeminiJSON(rawText);
  return validateResearchBrief(parsed);
}

export async function generateBlueprint(episode, strategy, researchBrief, universe, visualIdentity) {
  const model = await getGeminiModel();

  // Resolve bounded KB snapshot for blueprint stage
  let kbContext = '';
  try {
    const kbSnapshot = await createKbSnapshot({ channelId: episode.channel_id, seriesId: episode.series_id, stage: 'blueprint' });
    const kbKeys = Object.keys(kbSnapshot);
    if (kbKeys.length > 0) {
      kbContext = `\n    Knowledge Base Context (editorial playbook, content guide — treat as authoritative):\n    ${JSON.stringify(kbSnapshot, null, 2)}`;
    }
  } catch (_) { /* KB resolution optional */ }

  const prompt = `
    Anda adalah YouTube Video Architect. Buat Video Blueprint dengan chapter timing detail.
    Judul: "${episode.title}"
    Locale: "${episode.locale}"
    Target Duration: ${episode.target_duration_seconds} detik.
    Research Angle: "${researchBrief.episode_angle}"
    Content Pillars: ${strategy?.config_json?.content_pillars ? JSON.stringify(strategy.config_json.content_pillars) : 'None'}
    Universe Context: ${universe ? JSON.stringify(universe) : 'None'}
    Visual Style: ${visualIdentity ? JSON.stringify(visualIdentity) : 'None'}${kbContext}

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
          "pattern_interrupt": "visual/audio interrupt yang digunakan"
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

export async function generateScript(episode, blueprint, researchBrief, universe, visualIdentity) {
  const model = await getGeminiModel();

  const prompt = `
    Anda adalah Storyteller & Scriptwriter YouTube profesional. Tulis naskah scene-by-scene lengkap.
    Judul: "${episode.title}"
    Locale: "${episode.locale}"
    Target Duration: ${episode.target_duration_seconds} detik.
    Blueprint: ${JSON.stringify(blueprint)}
    Research Claims: ${JSON.stringify(researchBrief?.key_claims || [])}
    Visual Style Profile: ${visualIdentity ? JSON.stringify(visualIdentity) : 'None'}
    Universe Context: ${universe ? JSON.stringify(universe) : 'None'}

    Ketentuan naskah:
    - scene_type harus salah satu dari: generated_visual, broll, diagram, map, text_overlay, archive_style.
    - voiceover harus natural, siap dibaca oleh voice-over talent / TTS.
    - visual_direction harus detail menggambarkan scene.
    - Jumlah durasi scenes harus mendekati target durasi total.

    Format output wajib JSON dengan skema tepat berikut:
    {
      "title": "judul naskah",
      "estimated_total_duration_seconds": ${episode.target_duration_seconds},
      "scenes": [
        {
          "scene_index": 1,
          "chapter_order": 1,
          "purpose": "tujuan scene ini",
          "voiceover": "naskah voiceover lengkap untuk dibaca",
          "estimated_duration_seconds": 15,
          "scene_type": "generated_visual|broll|diagram|map|text_overlay|archive_style",
          "visual_direction": "panduan visual scene",
          "subtitle_cue": "tulis teks subtitle cue",
          "transition_note": "transisi (e.g. cut, fade)",
          "audio_cue": "efek suara / musik latar"
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
  const parsed = parseGeminiJSON(result.response.text());
  
  if (!parsed || !Array.isArray(parsed.concepts)) {
    throw new Error('Format output konsep tidak valid');
  }
  
  return parsed.concepts.map(validateSeriesConcept);
}
