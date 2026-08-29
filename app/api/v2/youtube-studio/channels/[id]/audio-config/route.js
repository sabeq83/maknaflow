import { withYouTubeStudioAccess } from '@/lib/auth';
import { getChannelAudioConfig, getChannelDraftAudioConfig, createDraftChannelAudioConfig } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const active = await getChannelAudioConfig(id);
    const draft = await getChannelDraftAudioConfig(id);
    return new Response(JSON.stringify({ success: true, active, draft }), {
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

export const PUT = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const input = await req.json();
    const config = await createDraftChannelAudioConfig(id, input, user);
    return new Response(JSON.stringify({ success: true, data: config }), {
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
