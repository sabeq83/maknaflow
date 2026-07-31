import { NextResponse } from 'next/server';
import { getAllIdeas, deleteIdea, updateIdeaStatus } from '@/lib/db';

export async function GET() {
  try {
    const ideas = await getAllIdeas();
    return NextResponse.json({ success: true, data: ideas });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    await deleteIdea(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, status } = await request.json();
    await updateIdeaStatus(id, status);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
