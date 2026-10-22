import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import {
  createStudioBatch,
  consumePlannerIntoBatch,
  listStudioBatches,
  getStudioBatchById
} from '@/lib/contentflow-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId() || 'default_tenant';
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const batches = await listStudioBatches(tenantId, { status, limit, offset });
    return NextResponse.json({ success: true, data: batches });
  } catch (error) {
    console.error('[ContentFlow Studio Batches GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, user) => {
  try {
    const tenantId = getActiveTenantId() || 'default_tenant';
    const body = await request.json();

    const {
      plannerId,
      engine,
      enginePayload = {},
      title,
      selectedRowIds = [],
      slotScheduleMap = {},
      defaultTargets = [],
      timezone = 'Asia/Jakarta',
      idempotencyKey = null
    } = body;

    if (!plannerId) {
      return NextResponse.json({
        success: false,
        error: 'plannerId wajib disertakan. ContentFlow Studio membutuhkan Planner satu sesi.'
      }, { status: 400 });
    }

    if (!engine || !['re', 'multiplier', 'recipe'].includes(engine)) {
      return NextResponse.json({
        success: false,
        error: 'Engine tidak valid. Pilihan: re, multiplier, recipe.'
      }, { status: 400 });
    }

    // 1. Create Studio Batch container
    const cleanTitle = title || `[ STUDIO ] - ${engine.toUpperCase()} - ${plannerId.slice(0, 8)}`;
    const batch = await createStudioBatch({
      tenantId,
      title: cleanTitle,
      sourceKind: engine,
      sourceId: plannerId,
      configurationJson: enginePayload,
      idempotencyKey,
      createdBy: user?.id || user?.username || 'user'
    });

    // 2. Atomically consume planner rows into batch slots
    const consumptionResult = await consumePlannerIntoBatch({
      tenantId,
      batchId: batch.id,
      plannerId,
      selectedRowIds,
      slotScheduleMap,
      defaultTargets,
      timezone,
      userId: user?.id || 'user'
    });

    // 3. Return full batch with slots
    const fullBatch = await getStudioBatchById(batch.id, tenantId);

    return NextResponse.json({
      success: true,
      message: `Berhasil membuat batch studio ${batch.id} dengan ${consumptionResult.slots.length} slot konten terjadwal.`,
      data: fullBatch
    }, { status: 201 });
  } catch (error) {
    console.error('[ContentFlow Studio Batches POST Error]:', error);
    return NextResponse.json({
      success: false,
      code: error.code || 'BATCH_CREATION_FAILED',
      error: error.message || 'Gagal membuat batch konten studio.'
    }, { status: error.status || 500 });
  }
});
