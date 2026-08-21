import { withYouTubeStudioAccess } from '@/lib/auth';
import { getChannel, getChannelDraftStrategy, createOrUpdateStrategyDraft } from '@/lib/youtube-studio-repository';
import { refineChannelStrategy } from '@/lib/youtube-studio-strategy-ai';
import { normalizeLocale } from '@/lib/youtube-studio-contract';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) {
    return new Response(JSON.stringify({ success: false, error: 'Channel not found' }), { status: 404 });
  }

  const currentDraft = await getChannelDraftStrategy(id);
  if (!currentDraft) {
    return new Response(JSON.stringify({ success: false, error: 'No active strategy draft found to refine' }), { status: 400 });
  }

  const body = await req.json();
  if (!body.instruction) {
    return new Response(JSON.stringify({ success: false, error: 'Refinement instruction is required' }), { status: 400 });
  }

  const locale = normalizeLocale(channel.primary_locale);
  const refinedConfig = await refineChannelStrategy({
    currentDraft: currentDraft.config_json,
    instruction: body.instruction,
    locale
  });

  const updatedDraft = await createOrUpdateStrategyDraft(id, {
    config: refinedConfig,
    brief: currentDraft.brief_json,
    universe_id: currentDraft.universe_id,
    visual_identity_preset_id: currentDraft.visual_identity_preset_id
  }, user);

  return new Response(JSON.stringify({ success: true, data: updatedDraft }), { status: 200 });
});
