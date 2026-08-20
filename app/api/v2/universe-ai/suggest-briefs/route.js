import { withTenantContext } from '@/lib/auth';
import { generateBriefSuggestions } from '@/lib/universe-ai-suggest';
import { mapUniverseAiError } from '@/lib/universe-ai-contract';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request) => {
  try {
    const body = await request.json();
    const seed = body.seed;

    if (!seed || typeof seed !== 'string' || !seed.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'INVALID_SEED_INPUT',
        message: 'Ide dasar (seed) wajib diisi.'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const options = await generateBriefSuggestions(seed);

    return new Response(JSON.stringify({
      success: true,
      options
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    return mapUniverseAiError(error);
  }
});
