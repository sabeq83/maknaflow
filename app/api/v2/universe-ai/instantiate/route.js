import { withTenantContext } from '@/lib/auth';
import { instantiateAiUniverse } from '@/lib/universe-ai-repository';
import { mapUniverseAiError } from '@/lib/universe-ai-contract';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request) => {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || !body.draft) {
      return new Response(JSON.stringify({
        success: false,
        code: 'INVALID_DRAFT',
        error: 'Request body must contain draft object.'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const result = await instantiateAiUniverse(body.draft, body.generation_meta || {});
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    return mapUniverseAiError(error);
  }
});
