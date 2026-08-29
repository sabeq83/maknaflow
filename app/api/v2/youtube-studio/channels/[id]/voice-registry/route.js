import { withYouTubeStudioAccess } from '@/lib/auth';
import { getChannelSpeakers, getChannelAudioConfig, getChannelDraftAudioConfig, getSpeakerVoiceCastings } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const speakers = await getChannelSpeakers(id);
    const activeConfig = await getChannelAudioConfig(id);
    const draftConfig = await getChannelDraftAudioConfig(id);
    const speakersWithCastings = await Promise.all(speakers.map(async speaker => ({
      ...speaker,
      castings: await getSpeakerVoiceCastings(speaker.id)
    })));
    return new Response(JSON.stringify({ success: true, speakers: speakersWithCastings, activeConfig, draftConfig }), {
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
