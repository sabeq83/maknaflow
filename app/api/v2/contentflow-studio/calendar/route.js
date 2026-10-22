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
        const snap = s.creative_snapshot_json || {};
        return snap.brand_profile_id === brandId || snap.selectedBrandId === brandId;
      });
    }

    const metrics = {
      total: slots.length,
      pending: slots.filter(s => s.stage_status === 'pending').length,
      in_progress: slots.filter(s => s.stage_status === 'in_progress').length,
      ready_for_review: slots.filter(s => s.stage_status === 'completed' && s.publishing_status === 'not_approved').length,
      approved: slots.filter(s => s.publishing_status === 'approved' || s.publishing_status === 'scheduled').length,
      published: slots.filter(s => s.publishing_status === 'published').length,
      failed: slots.filter(s => s.stage_status === 'failed' || s.publishing_status === 'failed').length
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
