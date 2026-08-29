import { withYouTubeStudioAccess } from '@/lib/auth';
import { updateChannelSpeaker, saveSpeakerVoiceCasting } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const PATCH = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id, speakerId } = await params;
  try {
    const input = await req.json();
    const speaker = await updateChannelSpeaker(id, speakerId, input, user);
    if (!speaker) {
      return new Response(JSON.stringify({ success: false, error: 'Speaker not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }

    if (input.casting) {
      const locale = input.locale || 'id-ID';
      await saveSpeakerVoiceCasting(speaker.id, locale, input.casting, user);
    }

    return new Response(JSON.stringify({ success: true, data: speaker }), {
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
