import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { getCalendarProjection } from '@/lib/contentflow-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId() || 'default_tenant';
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('start_date') || searchParams.get('startDate');
    const endDate = searchParams.get('end_date') || searchParams.get('endDate');
    const timezone = searchParams.get('timezone') || 'Asia/Jakarta';
    const status = searchParams.get('status') || 'all';
    const brandId = searchParams.get('brand_id') || searchParams.get('brandProfileId');

    const slots = await getCalendarProjection(tenantId, {
      startDate,
      endDate,
      timezone
    });

    // Optional in-memory filter for status and brandId
    let filtered = slots;
    if (status && status !== 'all') {
      filtered = filtered.filter(s => s.stage_status === status || s.publishing_status === status);
    }
    if (brandId && brandId !== 'all') {
      filtered = filtered.filter(s => {
        let snap = s.batch_config || {};
        if (typeof snap === 'string') {
          try { snap = JSON.parse(snap); } catch {}
        }
        let slotSnap = s.output_snapshot_json || {};
        if (typeof slotSnap === 'string') {
          try { slotSnap = JSON.parse(slotSnap); } catch {}
        }
        const bId = snap.brand_profile_id || snap.selectedBrandId || snap.brandId || snap.brand_id || snap.global_settings?.brand_profile_id || snap.global_settings?.brandId || slotSnap.brand_profile_id || slotSnap.brandId || slotSnap.row?.brand_profile_id || slotSnap.row?.brand_id;
        return String(bId) === String(brandId);
      });
    }

    const metrics = {
      total: filtered.length,
      pending: filtered.filter(s => s.stage_status === 'pending').length,
      in_progress: filtered.filter(s => s.stage_status === 'in_progress').length,
      ready_for_review: filtered.filter(s => ['ready','needs_review'].includes(s.stage_status) && s.publishing_status === 'not_approved').length,
      approved: filtered.filter(s => s.publishing_status === 'approved' || s.publishing_status === 'scheduled').length,
      published: filtered.filter(s => s.publishing_status === 'published').length,
      failed: filtered.filter(s => s.stage_status === 'failed' || s.publishing_status === 'failed').length
    };

    return NextResponse.json({
      success: true,
      data: filtered,
      metrics
    });
  } catch (error) {
    console.error('[ContentFlow Studio Calendar API Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal memuat proyeksi kalender studio.'
    }, { status: 500 });
  }
});
