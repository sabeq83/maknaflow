import { getGeminiModel, GEMINI_MODELS } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import {
  UNIVERSE_BUILDER_PROMPT_VERSION,
  validateUniverseBrief,
  validateAndNormalizeUniverseDraft
} from './universe-ai-contract.js';

export function buildUniverseGenerationPrompt(brief) {
  const jsonSchema = {
    profile: {
      name: "string (equal to brief.name)",
      slug: "string (url-safe version of name)",
      premise: "string (premise of the universe, max 500 chars)",
      tone: "string (tone from brief, max 200 chars)",
      knowledge_domain: "string (equal to brief.knowledge_domain)",
      universe_type: "string (equal to brief.universe_type)",
      human_presence: "string (none for non-human, allowed for human)",
      depiction_policy: "string or null (mandatory policy for human universe, describing why and how characters are faceless)",
      historical_period: "string or null (period from brief or conditional historical domain)",
      default_visual_style: "string (visual direction from brief)",
      default_aspect_ratio: "string (default: '9:16')",
      default_scene_count: 7,
      default_scene_duration: 8,
      default_story_template: "string (must match the domain's default template from the allowlisted templates)",
      cta_personality: "string (personality of calls to action, max 300 chars)",
      default_pillars_json: ["array of content pillars from brief, plus some creative variations, max 8"],
      rules_json: {
        "creative_rules": "string or array",
        "anti_anachronism": "string or null (mandatory for history/islamic_history domain)"
      },
      negative_prompts_json: ["array of negative prompts, MUST include faceless rules if human"]
    },
    characters: [
      {
        name: "string",
        character_key: "string (lowercase alphanumeric and underscore)",
        species: "string (e.g. rice cooker mascot, shiba inu, etc.)",
        breed: "string or null",
        body_shape: "string or null",
        fur_color: "string or null",
        eye_color: "string or null",
        wardrobe: "string or null",
        personality: "string",
        movement_style: "string or null",
        relative_size: "string ('small' | 'medium' | 'large')",
        role: "string ('main_character' | 'supporting' | 'observer')",
        depiction_mode: "string ('normal' for non-human; for human MUST be one of 'faceless', 'back_view', 'silhouette', 'environment_only')",
        reference_type: "string ('identity')",
        historical_period: "string or null",
        canonical_prompt: "string (detailed prompt in English visual terminology to generate this character's look consistently, including their clothes/accessories, body shape, and face depiction/faceless rules)",
        forbidden_changes_json: ["array of string: properties that should never change"]
      }
    ],
    locations: [
      {
        name: "string",
        location_key: "string (lowercase alphanumeric and underscore)",
        visual_description: "string (detailed scenery/environment description)",
        lighting_default: "string or null",
        props: "string or null",
        historical_period: "string or null",
        reference_type: "string ('location')"
      }
    ]
  };

  return `Kamu adalah world-building director dan production prompt architect.
Tugas kamu adalah merancang sebuah Cartoon/Claymation Universe berdasarkan creative brief yang diberikan.
Gunakan prompt version: ${UNIVERSE_BUILDER_PROMPT_VERSION}.

BRIEF INPUT:
${JSON.stringify(brief, null, 2)}

ATURAN DAN FORMAT OUTPUT:
1. Kembalikan HANYA sebuah object JSON yang valid sesuai skema berikut. Jangan menambahkan markdown code block, text pembuka/penutup, atau komentar apa pun di luar JSON tersebut.
2. Deskripsi narasi (premise, tone, personality, rules, description) harus dalam Bahasa Indonesia.
3. Bagian "canonical_prompt" untuk karakter dan "visual_description" untuk lokasi harus ditulis menggunakan English visual terminology agar kompatibel dengan AI Image/Video Generator.
4. Kamu WAJIB menghasilkan TEPAT sejumlah ${brief.character_count} karakter pada array "characters" dan TEPAT sejumlah ${brief.location_count} lokasi pada array "locations".
5. Jika universe_type === 'human':
   - "human_presence" WAJIB diatur menjadi "allowed".
   - "depiction_policy" WAJIB diisi dengan aturan penggambaran faceless (misal: "Seluruh karakter manusia digambarkan tanpa mata, hidung, atau mulut untuk menjaga anonimitas").
   - Array "characters" dilarang keras menggunakan depiction_mode "normal". Setiap karakter manusia wajib menggunakan salah satu dari: 'faceless', 'back_view', 'silhouette', 'environment_only'.
   - "canonical_prompt" setiap karakter manusia wajib mencantumkan instruksi faceless yang jelas sesuai mode yang dipilih (misal: "faceless, features deleted, blank smooth skin on face" atau "seen from behind, back view" atau "dark silhouette only").
   - "negative_prompts_json" pada profile wajib menyertakan: "visible face", "facial features", "reflection showing face", dan "identity drift".
6. Jika domain adalah 'history' atau 'islamic_history', kamu harus menambahkan aturan "anti_anachronism" di rules_json untuk melarang teknologi/pakaian modern.
7. Jangan membuat klaim produk komersial atau medis dalam narasi world-building.
8. Template cerita default_story_template harus disesuaikan dengan domain:
   - pet_supplies -> pet_problem_solution_7beat
   - history / islamic_history -> historical_explainer_7beat
   - herbal -> educational_discovery_7beat
   - domain lainnya -> problem_solution_7beat

SKEMA JSON OUTPUT:
${JSON.stringify(jsonSchema, null, 2)}`;
}

export async function generateUniverseDraft(input) {
  const brief = validateUniverseBrief(input);
  const model = await getGeminiModel();
  const prompt = buildUniverseGenerationPrompt(brief);
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const parsed = parseGeminiJSON(responseText);
  
  const draft = validateAndNormalizeUniverseDraft(parsed, {
    expectedCharacterCount: brief.character_count,
    expectedLocationCount: brief.location_count
  });

  return {
    draft,
    meta: {
      prompt_version: UNIVERSE_BUILDER_PROMPT_VERSION,
      model: GEMINI_MODELS.PRIMARY
    }
  };
}
