import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';

/**
 * Service to generate 3 structured Creative Brief options from a basic seed idea.
 * @param {string} seed - The basic seed idea from the user.
 * @returns {Promise<Array>} List of 3 structured brief option objects.
 */
export async function generateBriefSuggestions(seed) {
  if (!seed || !seed.trim()) {
    throw new Error('Seed idea is required');
  }

  const model = await getGeminiModel();

  const systemInstruction = `You are a creative brand strategist and narrative designer for MAKNA Flow.
Given a basic seed idea for a story universe, generate exactly 3 distinct, highly creative, and structured creative brief options.
Ensure the options are well-dramatized, diverse in approach (e.g. different universe types, tones, or visual angles), and match the seed.

Format the output strictly as a JSON object with this structure:
{
  "options": [
    {
      "name": "string (Creative universe name)",
      "universe_type": "string (MUST be one of: 'animal', 'mascot_object', 'human')",
      "knowledge_domain": "string (MUST be one of: 'general', 'pet_supplies', 'food_culinary', 'history', 'islamic_history', 'kitchen', 'home_improvement', 'herbal')",
      "purpose": "string (Purpose of content creation, e.g. marketing, brand building, edutainment)",
      "target_audience": "string (Target audience on YouTube, max 150 chars)",
      "premise_seed": "string (Dramatized narrative premise, max 300 chars)",
      "tone": "string (e.g. satirical, dramatic, educational, dark comedy)",
      "visual_direction": "string (Visual style direction, e.g. Claymation, 3D render, flat illustration)",
      "character_count": number (between 2 and 4),
      "location_count": number (between 2 and 4),
      "content_pillars": "string (Comma-separated short keywords/pillars)",
      "special_constraints": "string (Any styling/depiction rules or constraints)"
    }
  ]
}

Only return valid JSON matching the schema. Do NOT wrap in markdown block, just return raw JSON.`;

  const userPrompt = `Seed Idea: "${seed.trim()}"`;

  const response = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      systemInstruction: systemInstruction,
      temperature: 0.8
    }
  });

  const text = response.response.text();
  const parsed = parseGeminiJSON(text);

  if (!parsed || !Array.isArray(parsed.options)) {
    throw new Error('Failed to parse structured JSON from Gemini');
  }

  // Normalize options to ensure fallback values and safe properties
  const validDomains = ['general', 'pet_supplies', 'food_culinary', 'history', 'islamic_history', 'kitchen', 'home_improvement', 'herbal'];
  const validTypes = ['animal', 'mascot_object', 'human'];

  return parsed.options.map(opt => ({
    name: String(opt.name || 'Untitled Universe').slice(0, 100),
    universe_type: validTypes.includes(opt.universe_type) ? opt.universe_type : 'animal',
    knowledge_domain: validDomains.includes(opt.knowledge_domain) ? opt.knowledge_domain : 'general',
    purpose: String(opt.purpose || '').slice(0, 500),
    target_audience: String(opt.target_audience || '').slice(0, 200),
    premise_seed: String(opt.premise_seed || '').slice(0, 500),
    tone: String(opt.tone || '').slice(0, 200),
    visual_direction: String(opt.visual_direction || '').slice(0, 200),
    character_count: Math.min(4, Math.max(2, Number(opt.character_count) || 2)),
    location_count: Math.min(4, Math.max(2, Number(opt.location_count) || 2)),
    content_pillars: String(opt.content_pillars || '').slice(0, 300),
    special_constraints: String(opt.special_constraints || '').slice(0, 300)
  }));
}
