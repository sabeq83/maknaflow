import { withTenantContext } from '@/lib/auth';
import { generateUniverseDraft } from '@/lib/universe-ai-builder';
import { mapUniverseAiError } from '@/lib/universe-ai-contract';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request) => {
  try {
    const body = await request.json();
    const result = await generateUniverseDraft(body);
    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    return mapUniverseAiError(error);
  }
});
