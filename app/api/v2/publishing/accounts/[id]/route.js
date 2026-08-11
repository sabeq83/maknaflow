import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import {
  getPublishingAccountById,
  updatePublishingAccount,
  deletePublishingAccount
} from '@/lib/publishing-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const account = await getPublishingAccountById(tenantId, id, false);

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Akun publishing tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: account
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});

export const PATCH = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const body = await request.json();

    const updated = await updatePublishingAccount(tenantId, id, body);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Akun publishing tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 400 }
    );
  }
});

export const DELETE = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const deleted = await deletePublishingAccount(tenantId, id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Akun publishing tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Akun publishing berhasil dihapus.'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});
