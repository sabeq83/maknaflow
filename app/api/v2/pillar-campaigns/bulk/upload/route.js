import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `bulk_opc_${Date.now()}_${cleanName}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    const relativePath = `/uploads/products/${filename}`;

    return NextResponse.json({
      success: true,
      filePath: relativePath,
      filename: cleanName
    }, { status: 200 });

  } catch (err) {
    console.error('[Bulk OPC Upload] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
