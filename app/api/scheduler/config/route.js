import { NextResponse } from 'next/server';
import { getAllSchedulerConfigs, updateSchedulerConfig } from '@/lib/db';

export async function GET() {
  try {
    const configs = await getAllSchedulerConfigs();
    return NextResponse.json({ success: true, data: configs });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { queue_name, ...updates } = await request.json();
    if (!queue_name) {
      return NextResponse.json({ success: false, error: 'queue_name wajib diisi' }, { status: 400 });
    }
    await updateSchedulerConfig(queue_name, updates);
    const configs = await getAllSchedulerConfigs();
    return NextResponse.json({ success: true, data: configs });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
