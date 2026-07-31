import { NextResponse } from 'next/server';
import { getBrandProfile, updateBrandProfile, deleteBrandProfile } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const profile = await getBrandProfile(id);
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await updateBrandProfile(id, body);
    return NextResponse.json({ success: true, message: 'Brand Profile updated' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    await deleteBrandProfile(id);
    return NextResponse.json({ success: true, message: 'Brand Profile deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
