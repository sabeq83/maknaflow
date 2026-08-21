import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export async function generateBlueprint(episode, strategy) {
  const tenantId = getActiveTenantId();
  const model = await getGeminiModel();
  
  const prompt = `
    Anda adalah YouTube Studio Architect. Buat struktur Blueprint Video YouTube Landscape 16:9 Faceless AI.
    Topic/Title: "${episode.title}"
    Locale: "${episode.locale}"
    Target Duration: ${episode.target_duration_seconds} detik.

    Struktur Output harus valid JSON dengan key:
    - content_promise (String)
    - hook (String, text 30-60 detik)
    - chapters (Array of object: { title, target_duration, narrative_focus })
    - CTA (String, call to action)
    - next_video_bridge (String)
  `;

  const result = await model.generateContent(prompt);
  const parsed = parseGeminiJSON(result.response.text());
  
  const blueprintId = `ytbp_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_episode_blueprints (id, tenant_id, episode_id, content_json)
    VALUES ($1, $2, $3, $4) RETURNING *
  `, [blueprintId, tenantId, episode.id, JSON.stringify(parsed)]);
  
  return res.rows[0];
}

export async function generateScript(episode, blueprint) {
  const tenantId = getActiveTenantId();
  const model = await getGeminiModel();

  const prompt = `
    Anda adalah Storyteller YouTube profesional. Berdasarkan blueprint berikut:
    ${JSON.stringify(blueprint.content_json)}
    
    Hasilkan naskah lengkap (Voice-Over) dan visual direction per scene.
    Locale: "${episode.locale}"
    Visual style direction must align with visual identities.
    
    Output JSON format only:
    {
      "scenes": [
        {
          "scene_index": 1,
          "voiceover": "Teks naskah natural dibaca VO",
          "visual_direction": "Instruksi visual/B-Roll sinematik",
          "estimated_duration_seconds": 10
        }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const parsed = parseGeminiJSON(result.response.text());

  const scriptId = `ytsc_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_episode_scripts (id, tenant_id, episode_id, blueprint_id, locale, script_json)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [scriptId, tenantId, episode.id, blueprint.id, episode.locale, JSON.stringify(parsed)]);

  return res.rows[0];
}
