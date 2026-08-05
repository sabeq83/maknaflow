import { NextResponse } from 'next/server';
import { syncItemAssetsToCloud, getLocalItemAssetsManifest } from '@/lib/manual-asset-uploader';

import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    const manifest = await getLocalItemAssetsManifest('re', itemId);
    return NextResponse.json({ success: true, manifest });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    const result = await syncItemAssetsToCloud('re', itemId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
