import { NextResponse } from 'next/server';
import { retryJob } from '@/lib/db';

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    await retryJob(id);
    return NextResponse.json({ success: true, message: `Job ${id} has been requeued.` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
