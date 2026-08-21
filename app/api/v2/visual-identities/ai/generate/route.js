import { withTenantContext } from '@/lib/auth';
import { generateAiVisualIdentityDraft } from '@/lib/visual-identity-ai-builder';

export const dynamic = 'force-dynamic';

function requireVisualIdentityAiAccess(user) {
  if (!user) {
    const err = new Error('Unauthorized');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const isAllowed = user.role === 'admin' || user.role === 'superadmin' || user.menuPermissions?.includes('operator_presets');
  const isDisabled = user.tenantDisabledMenus?.includes('operator_presets');
  if (!isAllowed || isDisabled) {
    const err = new Error('Forbidden: Access to Visual Identity Studio is not authorized');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
}

function mapAiVisualIdentityError(error) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = error.message || 'Internal Server Error';

  if (error.name === 'AiVisualIdentityValidationError' || error.code === 'INVALID_AI_VISUAL_BRIEF') {
    status = 400;
    code = 'INVALID_AI_VISUAL_BRIEF';
  } else if (error.code === 'FACELESS_POLICY_VIOLATION') {
    status = 422;
    code = 'FACELESS_POLICY_VIOLATION';
  } else if (error.code === 'INVALID_AI_VISUAL_OUTPUT') {
    status = 422;
    code = 'INVALID_AI_VISUAL_OUTPUT';
  } else if (error.status === 401 || error.code === 'UNAUTHORIZED') {
    status = 401;
    code = 'UNAUTHORIZED';
  } else if (error.status === 403 || error.code === 'FORBIDDEN') {
    status = 403;
    code = 'FORBIDDEN';
  } else if (error.status === 429 || error.status === 503 || message.includes('API_key') || message.includes('API Key') || message.includes('timed out') || message.includes('overloaded') || message.includes('503')) {
    status = 503;
    code = 'AI_TEMPORARILY_UNAVAILABLE';
    message = 'AI Generative Service is temporarily overloaded or unavailable. Please retry shortly.';
  }

  return new Response(JSON.stringify({ success: false, error: message, code }), {
    status,
    headers: {
      'content-type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    requireVisualIdentityAiAccess(user);
    const body = await request.json();
    const data = await generateAiVisualIdentityDraft(body);
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return mapAiVisualIdentityError(error);
  }
});
