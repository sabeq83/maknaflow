import { listPresets } from '@/lib/universe-presets';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const presets = listPresets();
  return new Response(JSON.stringify({ success: true, data: presets }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
