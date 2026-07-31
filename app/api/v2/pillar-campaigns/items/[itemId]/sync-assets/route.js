import { NextResponse } from 'next/server';
import { syncItemAssetsToCloud, getLocalItemAssetsManifest } from '@/lib/manual-asset-uploader';

export async function GET(request, { params }) {
  try {
    const { itemId } = await params;
    const manifest = await getLocalItemAssetsManifest('opc', itemId);
    return NextResponse.json({ success: true, manifest });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { itemId } = await params;
    const result = await syncItemAssetsToCloud('opc', itemId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
