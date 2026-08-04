import { NextResponse } from 'next/server';
import { getAllBrandProfiles, createBrandProfile } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from '@/lib/auth';
import { tenantContext } from '@/lib/tenant-context';
import { validateBrandEditorialDefaults } from '@/lib/brand-editorial-defaults';

export const dynamic = 'force-dynamic';

function tenantUser(req, { admin = false } = {}) {
  const user = getCurrentUser(req);
  if (!user || user.tenantId === '__none__') return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: user ? 403 : 401 }) };
  if (admin && user.role !== 'admin') return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function GET(req) {
  try {
    const auth = tenantUser(req);
    if (auth.error) return auth.error;
    let profiles = await tenantContext.run(auth.user.tenantId, () => getAllBrandProfiles());
    if (auth.user.role !== 'admin') {
      const allowed = new Set(auth.user.assignedBrandIds || []);
      profiles = profiles.filter(profile => allowed.has(profile.id));
    }
    return NextResponse.json({ success: true, data: profiles });
  } catch (error) {
    console.error('Brand Profiles GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = tenantUser(req, { admin: true });
    if (auth.error) return auth.error;
    const body = await req.json();
    const id = uuidv4();

    if (!body.brand_name || !body.visual_signature) {
      return NextResponse.json({ success: false, error: 'Brand Name dan Visual Signature wajib diisi.' }, { status: 400 });
    }

    const editorial = validateBrandEditorialDefaults(body);
    await tenantContext.run(auth.user.tenantId, () => createBrandProfile({
      id,
      brand_name: body.brand_name,
      tone_of_voice: body.tone_of_voice,
      visual_signature: body.visual_signature,
      raw_guideline_text: body.raw_guideline_text,
      guideline_filename: body.guideline_filename,
      storage_provider: body.storage_provider,
      nextcloud_target_folder: body.nextcloud_target_folder,
      drive_target_folder: body.drive_target_folder,
      drive_glabs_folder_id: body.drive_glabs_folder_id,
      webhook_host: body.webhook_host,
      webhook_port: body.webhook_port,
      webhook_api_key: body.webhook_api_key,
      ...editorial,
    }));

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Brand Profiles POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: error.code === 'BRAND_EDITORIAL_VALIDATION' ? 400 : 500 });
  }
}
