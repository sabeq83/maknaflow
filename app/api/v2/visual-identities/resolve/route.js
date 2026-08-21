import { withTenantContext } from '@/lib/auth';
import { resolveVisualIdentity } from '@/lib/visual-override-resolver';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  try {
    const body = await req.json();
    const result = await resolveVisualIdentity({
      presetRef: body.preset_id || body.preset_key || body.visual_identity_preset_id || null,
      inlineConfig: body.inline_config || body.visual_identity_inline_config || null,
      legacyOverrides: body.legacy_overrides_json || body.visual_overrides_json || null,
      itemContext: body.item_context || {}
    });

    return new Response(JSON.stringify({ 
      success: true, 
      data: {
        ref: result.identity_ref || null,
        snapshot: result
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
});
