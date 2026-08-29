import { withYouTubeStudioAccess } from '@/lib/auth';
import { getChannelSonicIdentity, updateChannelSonicIdentity } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const data = await getChannelSonicIdentity(id);
    return new Response(JSON.stringify({ success: true, data }), {
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
    const config = await updateChannelSonicIdentity(id, input, user);
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
