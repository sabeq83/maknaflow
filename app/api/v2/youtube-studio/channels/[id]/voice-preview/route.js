import { withYouTubeStudioAccess } from '@/lib/auth';
import { generateVoiceSegment } from '@/lib/youtube-studio-voice-adapter';
import path from 'path';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  try {
    const input = await req.json();
    const tempFile = `yt_preview_${Math.random().toString(36).slice(2, 10)}.wav`;
    const outputPath = path.join(process.cwd(), 'public', 'temp', tempFile);
    
    await generateVoiceSegment({
      text: input.text || 'Halo, ini adalah suara pengetesan sistem.',
      locale: input.locale || 'id-ID',
      provider: input.provider || 'google_tts',
      persona: input.persona || 'id-ID-Wavenet-B',
      speed: input.speed || 1.0,
      outputPath
    });
    
    return new Response(JSON.stringify({ success: true, url: `/temp/${tempFile}` }), {
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
