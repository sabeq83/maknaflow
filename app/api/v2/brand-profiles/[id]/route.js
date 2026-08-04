import { NextResponse } from 'next/server';
import { getBrandProfile, updateBrandProfile, deleteBrandProfile } from '@/lib/db';
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

function canReadBrand(user, id) {
  return user.role === 'admin' || (user.assignedBrandIds || []).includes(id);
}

export async function GET(req, { params }) {
  try {
    const auth = tenantUser(req);
    if (auth.error) return auth.error;
    const { id } = await params;
    if (!canReadBrand(auth.user, id)) {
      return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    }
    const profile = await tenantContext.run(auth.user.tenantId, () => getBrandProfile(id));
    if (!profile) return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const auth = tenantUser(req, { admin: true });
    if (auth.error) return auth.error;
    const { id } = await params;
    const body = await req.json();
    const profile = await tenantContext.run(auth.user.tenantId, () => getBrandProfile(id));
    if (!profile) return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    const editorial = validateBrandEditorialDefaults(body);
    await tenantContext.run(auth.user.tenantId, () => updateBrandProfile(id, { ...body, ...editorial }));
    return NextResponse.json({ success: true, message: 'Brand Profile updated' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.code === 'BRAND_EDITORIAL_VALIDATION' ? 400 : 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = tenantUser(req, { admin: true });
    if (auth.error) return auth.error;
    const { id } = await params;
    const profile = await tenantContext.run(auth.user.tenantId, () => getBrandProfile(id));
    if (!profile) return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    await tenantContext.run(auth.user.tenantId, () => deleteBrandProfile(id));
    return NextResponse.json({ success: true, message: 'Brand Profile deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
