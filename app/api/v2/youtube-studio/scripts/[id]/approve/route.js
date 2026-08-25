import { withTenantContext } from '@/lib/auth';
import { approveScript } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();
  const result = await approveScript(id, user, body.review_note || null, {
    allowDurationOverride: body.allow_duration_override === true,
    overrideReason: body.duration_override_reason || null
  });
  return new Response(JSON.stringify({ success: true, data: result }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

