import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import {
  getPublishingJobById,
  reschedulePublishingJob,
  cancelPublishingJob,
  approvePublishingJob
} from '@/lib/publishing-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const job = await getPublishingJobById(tenantId, id);

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Publishing job tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: job
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});

export const PATCH = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const body = await request.json();
    const { action, scheduledAt, reason } = body;

    let result;
    if (action === 'reschedule') {
      if (!scheduledAt) {
        return NextResponse.json({ success: false, error: 'scheduledAt wajib diisi untuk reschedule.' }, { status: 400 });
      }
      result = await reschedulePublishingJob(tenantId, id, scheduledAt);
    } else if (action === 'cancel') {
      result = await cancelPublishingJob(tenantId, id, reason);
    } else if (action === 'approve') {
      result = await approvePublishingJob(tenantId, id, user?.id || 'admin');
    } else {
      return NextResponse.json(
        { success: false, error: `Action '${action}' tidak dikenal. Pilih: 'reschedule', 'cancel', atau 'approve'.` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Action '${action}' berhasil dijalankan.`,
      data: result
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 400 }
    );
  }
});
