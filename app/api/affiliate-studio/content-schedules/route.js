import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import {
  listAffiliateSchedules,
  createAffiliatePlanSchedules,
  updateAffiliateSchedule,
  deleteAffiliateSchedule
} from '@/lib/affiliate-content-schedules-repository';
import { listPublishingAccounts } from '@/lib/publishing-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId();
    const { searchParams } = new URL(request.url);

    const brandProfileId = searchParams.get('brand_profile_id') || searchParams.get('brand_id') || '';
    const brandName = searchParams.get('brand_name') || searchParams.get('brand') || '';
    const month = searchParams.get('month') ? parseInt(searchParams.get('month'), 10) : undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year'), 10) : undefined;
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const status = searchParams.get('status') || 'all';

    const [schedules, accounts] = await Promise.all([
      listAffiliateSchedules({
        tenantId,
        brandProfileId,
        brandName,
        month,
        year,
        startDate,
        endDate,
        status
      }),
      listPublishingAccounts(tenantId).catch(() => [])
    ]);

    return NextResponse.json({
      success: true,
      data: schedules,
      accounts: accounts.filter(a => a.status === 'active')
    });
  } catch (error) {
    console.error('[Affiliate Content Schedules GET Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat jadwal kalender affiliate.' },
      { status: 500 }
    );
  }
});

export const POST = withTenantContext(async (request, context, user) => {
  try {
    const tenantId = getActiveTenantId();
    const body = await request.json();

    const {
      plan_type,
      brand_profile_id,
      brand_id,
      brand_name,
      product_id,
      product_name,
      promotion_context,
      target_platforms,
      target_account_ids,
      items
    } = body;

    const created = await createAffiliatePlanSchedules({
      tenantId,
      brandProfileId: brand_profile_id || brand_id || null,
      planType: plan_type || 'product_campaign',
      brandName: brand_name,
      productId: product_id || null,
      productName: product_name || null,
      promotionContext: promotion_context || '',
      targetPlatforms: target_platforms || ['instagram', 'tiktok', 'facebook'],
      targetAccountIds: target_account_ids || [],
      items: items || [],
      createdBy: user?.id || null
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil menambahkan ${created.length} jadwal konten ke kalender.`,
      data: created
    });
  } catch (error) {
    console.error('[Affiliate Content Schedules POST Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan rencana kalender.' },
      { status: 400 }
    );
  }
});

export const PUT = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Schedule ID wajib disertakan.' },
        { status: 400 }
      );
    }

    const updated = await updateAffiliateSchedule(tenantId, id, updateData);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Jadwal tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Jadwal berhasil diperbarui.',
      data: updated
    });
  } catch (error) {
    console.error('[Affiliate Content Schedules PUT Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui jadwal.' },
      { status: 500 }
    );
  }
});

export const DELETE = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Schedule ID wajib disertakan.' },
        { status: 400 }
      );
    }

    const deleted = await deleteAffiliateSchedule(tenantId, id);
    return NextResponse.json({
      success: true,
      deleted
    });
  } catch (error) {
    console.error('[Affiliate Content Schedules DELETE Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus jadwal.' },
      { status: 500 }
    );
  }
});
