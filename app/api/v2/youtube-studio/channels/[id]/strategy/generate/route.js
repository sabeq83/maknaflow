import { withYouTubeStudioAccess } from '@/lib/auth';
import { getChannel, createOrUpdateStrategyDraft } from '@/lib/youtube-studio-repository';
import { generateChannelStrategy } from '@/lib/youtube-studio-strategy-ai';
import { normalizeLocale, normalizeStrategyBrief } from '@/lib/youtube-studio-contract';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) {
    return new Response(JSON.stringify({ success: false, error: 'Channel not found' }), { status: 404 });
  }

  const body = await req.json();
  let brief;
  try {
    brief = normalizeStrategyBrief(body.brief || {});
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 400 });
  }

  const locale = normalizeLocale(channel.primary_locale);
  const strategyConfig = await generateChannelStrategy({
    brief,
    locale,
    universe: body.universe || null,
    visualIdentity: body.visual_identity || null
  });

  const draft = await createOrUpdateStrategyDraft(id, {
    config: strategyConfig,
    brief,
    universe_id: brief.universe_id,
    visual_identity_preset_id: brief.visual_identity_preset_id
  }, user);

  return new Response(JSON.stringify({ success: true, data: draft }), { status: 200 });
});
