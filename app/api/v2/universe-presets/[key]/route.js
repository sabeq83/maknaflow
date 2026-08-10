import { getPreset } from '@/lib/universe-presets';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { key } = await params;
  const preset = getPreset(key);
  if (!preset) {
    return new Response(JSON.stringify({ success: false, error: 'Preset not found' }), {
      status: 404, headers: { 'content-type': 'application/json' }
    });
  }
  // Return preset WITHOUT internal structure that exposes filesystem paths
  const { key: pKey, version, label, icon, description, profile, characters, locations } = preset;
  // Strip reference_image_path and style_reference_path before returning to client
  const safeProfile = { ...profile, style_reference_path: undefined };
  const safeChars = characters.map(c => ({ ...c, reference_image_path: undefined }));
  const safeLocs = locations.map(l => ({ ...l, reference_image_path: undefined }));
  return new Response(JSON.stringify({
    success: true,
    data: { key: pKey, version, label, icon, description, profile: safeProfile, characters: safeChars, locations: safeLocs }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}
