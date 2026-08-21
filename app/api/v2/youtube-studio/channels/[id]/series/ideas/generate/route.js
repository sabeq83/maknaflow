import { withTenantContext } from '@/lib/auth';
import { getChannel, getChannelStrategy } from '@/lib/youtube-studio-repository';
import { generateSeriesConcepts } from '@/lib/youtube-studio-planner';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) {
    return new Response(JSON.stringify({ success: false, error: 'Channel tidak ditemukan' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  const strategy = await getChannelStrategy(id);
  if (!strategy) {
    return new Response(JSON.stringify({ success: false, error: 'Strategi channel aktif diperlukan untuk membuat konsep series.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  try {
    const concepts = await generateSeriesConcepts(channel, strategy);
    return new Response(JSON.stringify({ success: true, data: concepts }), {
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
