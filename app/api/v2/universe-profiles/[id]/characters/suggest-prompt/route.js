import { withTenantContext } from '@/lib/auth';
import { getGeminiModel } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { character, visual_style } = await request.json();
    if (!character) {
      return new Response(JSON.stringify({ success: false, error: 'Character data is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const systemPrompt = `You are a text-to-image prompt engineering expert.
Given a character description and the visual style of a story universe, write a detailed and visually stunning text-to-image prompt in English.
Make it highly compatible with modern image generators (like Midjourney or Imagen).
Focus on visual descriptors, textures, character materials (e.g. textured clay for claymation), lighting, and clear composition.
Do NOT output any conversational text or markdown code blocks. Just output the final raw prompt in English.`;

    const model = await getGeminiModel(null, systemPrompt);

    const userPrompt = `Character Details:
- Name: ${character.name || 'N/A'}
- Species: ${character.species || 'N/A'}
- Breed: ${character.breed || 'N/A'}
- Personality: ${character.personality || 'N/A'}
- Wardrobe: ${character.wardrobe || 'N/A'}
- Body Shape: ${character.body_shape || 'N/A'}

Universe Visual Style: ${visual_style || 'General'}`;

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7
      }
    });

    const promptText = response.response.text().trim();

    return new Response(JSON.stringify({
      success: true,
      prompt: promptText
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
});
