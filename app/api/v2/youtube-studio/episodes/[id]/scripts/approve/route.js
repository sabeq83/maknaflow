import { withTenantContext } from '@/lib/auth';
import { approveScript, getLatestScript } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const latest = await getLatestScript(id);
  return new Response(JSON.stringify({ success: true, data: latest }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  try {
    const { script_id, review_note, allow_duration_override, duration_override_reason } = await req.json();
    if (!script_id) {
      return new Response(JSON.stringify({ success: false, error: 'Script ID is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const approved = await approveScript(script_id, user, review_note || null, {
      allowDurationOverride: allow_duration_override === true,
      overrideReason: duration_override_reason || null
    });
    return new Response(JSON.stringify({ success: true, data: approved }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
});

