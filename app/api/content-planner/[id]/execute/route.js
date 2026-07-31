import { NextResponse } from 'next/server';
import { executeContentPlanner } from '@/lib/content-planner-engine';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const result = await executeContentPlanner(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[API /content-planner/[id]/execute POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
