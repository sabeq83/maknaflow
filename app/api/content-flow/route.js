import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listContentFlowItems } from '@/lib/contentflow-repository';

export async function GET(request) {
  try {
    const currentUser = getCurrentUser(request);
    if (!currentUser || currentUser.tenantId === '__none__') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: currentUser ? 403 : 401 });
    }
    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('source_type') || 'all';
    const accountName = searchParams.get('account') || 'all';
    const productName = searchParams.get('product') || 'all';
    const pipelineStatus = searchParams.get('pipeline_status') || 'all';
    const tiktokStatus = searchParams.get('tiktok_status') || 'Semua';
    const facebookStatus = searchParams.get('facebook_status') || 'Semua';
    const instagramStatus = searchParams.get('instagram_status') || 'Semua';
    const q = searchParams.get('q') || '';
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '50';

    const allowedAccounts = currentUser.role === 'admin' ? undefined : currentUser.assignedBrandNames;
    const result = await listContentFlowItems({ sourceType, accountName, productName, pipelineStatus, tiktokStatus, facebookStatus, instagramStatus, q, page, limit, allowedAccounts });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('[API /api/content-flow Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: err.status || 500 });
  }
}
