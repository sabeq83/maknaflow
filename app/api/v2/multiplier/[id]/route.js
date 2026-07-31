import { NextResponse } from 'next/server';
import { getMultiplierTaskById, deleteMultiplierTask, updateMultiplierTask } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const task = await getMultiplierTaskById(id);
    
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('[Multiplier API] GET detail error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteMultiplierTask(id);
    return NextResponse.json({ success: true, message: 'Task berhasil dihapus' });
  } catch (error) {
    console.error('[Multiplier API] DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ success: false, error: 'Field "status" wajib diisi' }, { status: 400 });
    }

    const task = await getMultiplierTaskById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
    }

    await updateMultiplierTask(id, { status });
    return NextResponse.json({ success: true, message: `Status task berhasil diubah menjadi ${status}` });
  } catch (error) {
    console.error('[Multiplier API] PATCH error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
