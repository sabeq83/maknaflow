import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import {
  listPublishingJobs,
  createPublishingJobs
} from '@/lib/publishing-repository';
import { validateScheduleRequest } from '@/lib/publishing-contract';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId();
    const { searchParams } = new URL(request.url);

    const view = searchParams.get('view') || 'all';
    const status = searchParams.get('status') || 'all';
    const platform = searchParams.get('platform') || 'all';
    const accountId = searchParams.get('account_id') || searchParams.get('accountId') || 'all';
    const brand = searchParams.get('brand') || searchParams.get('brand_profile') || 'all';
    const contentId = searchParams.get('content_id') || searchParams.get('contentId') || '';
    const startDate = searchParams.get('start_date') || searchParams.get('startDate') || '';
    const endDate = searchParams.get('end_date') || searchParams.get('endDate') || '';
    const search = searchParams.get('search') || searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await listPublishingJobs(tenantId, {
      view,
      status,
      platform,
      accountId,
      brand,
      contentId,
      startDate,
      endDate,
      search,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      metrics: result.metrics
    });
  } catch (error) {
    console.error('[Publishing Jobs GET Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat antrean jadwal publikasi.' },
      { status: error.status || 500 }
    );
  }
});

import { schedulePublishingJobs } from '@/lib/publishing-service';

export const POST = withTenantContext(async (request, user) => {
  try {
    const tenantId = getActiveTenantId();
    const rawBody = await request.json();
    const result = await schedulePublishingJobs({
      tenantId,
      userId: user?.id || null,
      rawBody
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[Publishing Jobs POST Error]:', error);
    return NextResponse.json(
      {
        success: false,
        code: error.code || 'SCHEDULE_ERROR',
        error: error.message || 'Gagal membuat jadwal publikasi.',
        reconnectUrl: error.reconnectUrl || null
      },
      { status: error.status || 400 }
    );
  }
});

