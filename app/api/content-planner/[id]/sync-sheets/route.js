import { NextResponse } from 'next/server';
import { syncPlannerToGoogleSheet } from '@/lib/content-planner-engine';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const result = await syncPlannerToGoogleSheet(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[API /content-planner/[id]/sync-sheets POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
