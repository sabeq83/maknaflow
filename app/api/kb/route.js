import { NextResponse } from 'next/server';
import { getAllKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const kbs = await getAllKnowledgeBases();
    return NextResponse.json({ success: true, data: kbs });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const name = formData.get('name');

    if (!file) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 });
    }

    const content = await file.text();
    const fileName = file.name;
    const fileType = fileName.endsWith('.json') ? 'json' : 'md';
    
    const kb = {
      id: uuidv4(),
      name: name || fileName.replace(/\.(md|txt|json)$/, ''),
      content: content,
      file_type: fileType,
      file_size: content.length,
    };

    await createKnowledgeBase(kb);
    return NextResponse.json({ success: true, data: { id: kb.id, name: kb.name } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    await deleteKnowledgeBase(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
