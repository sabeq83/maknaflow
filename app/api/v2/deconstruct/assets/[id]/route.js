import { NextResponse } from 'next/server';
import { getDeconstructAssetById, updateDeconstructAsset, getDb } from '@/lib/db';
import { getActiveTenantId } from '@/lib/tenant-context';
import { withTenantContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const asset = await getDeconstructAssetById(id, tenantId);

    if (!asset) {
      return NextResponse.json({ success: false, error: 'Aset tidak ditemukan' }, { status: 404 });
    }

    let storyboard = [];
    let productIdeas = {};
    try { storyboard = JSON.parse(asset.original_storyboard_json || '[]'); } catch {}
    try { productIdeas = JSON.parse(asset.product_ideas_json || '{}'); } catch {}

    return NextResponse.json({
      success: true,
      asset: {
        ...asset,
        storyboard,
        product_ideas: productIdeas
      }
    });
  } catch (error) {
    console.error('[Deconstruct Asset API] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PUT = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const body = await request.json();

    const asset = await getDeconstructAssetById(id, tenantId);
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Aset tidak ditemukan' }, { status: 404 });
    }

    const updates = {};
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.niche !== undefined) updates.niche = body.niche;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'Metadata update tidak valid' }, { status: 400 });
    }

    await updateDeconstructAsset(id, updates);
    return NextResponse.json({ success: true, message: 'Metadata asset berhasil diperbarui' });
  } catch (error) {
    console.error('[Deconstruct Asset API] PUT error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const DELETE = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();

    const asset = await getDeconstructAssetById(id, tenantId);
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Aset tidak ditemukan' }, { status: 404 });
    }

    if (['downloading', 'uploading', 'analyzing'].includes(asset.status)) {
      return NextResponse.json({ success: false, error: 'Aset sedang diproses tidak boleh dihapus' }, { status: 400 });
    }

    const db = getDb();
    await db.prepare('DELETE FROM re_deconstructed_assets WHERE id = ? AND tenant_id = ?').run(id, tenantId);

    return NextResponse.json({ success: true, message: 'Aset berhasil dihapus' });
  } catch (error) {
    console.error('[Deconstruct Asset API] DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
