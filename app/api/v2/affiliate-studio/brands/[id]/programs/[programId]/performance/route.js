import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getProgramPerformanceSummary, importPerformanceSnapshots } from '@/lib/affiliate-studio-performance-adapter';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId } = await params;
    const summary = await getProgramPerformanceSummary(user, brandId, programId);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('[API /performance GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId } = await params;
    const body = await request.json();

    if (!body.snapshots || !Array.isArray(body.snapshots)) {
      return NextResponse.json({ success: false, error: 'Missing or invalid snapshots payload' }, { status: 400 });
    }

    const importedIds = await importPerformanceSnapshots(user, brandId, programId, body.snapshots);
    return NextResponse.json({ success: true, data: { importedCount: importedIds.length } });
  } catch (error) {
    console.error('[API /performance POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
