import { NextResponse } from 'next/server';
import { uploadToDriveBatch } from '@/lib/drive-uploader';

/**
 * POST /api/drive/upload-asset
 * Download file from webhook → upload to Drive in batch folder
 * 
 * Body: { file_url, batch_id, filename, mime_type }
 */
export async function POST(request) {
  try {
    const { file_url, batch_id, filename, mime_type } = await request.json();

    if (!file_url || !batch_id || !filename) {
      return NextResponse.json({ success: false, error: 'file_url, batch_id, filename wajib diisi' }, { status: 400 });
    }

    const result = await uploadToDriveBatch({
      fileUrl: file_url,
      batchId: batch_id,
      filename,
      mimeType: mime_type || 'application/octet-stream',
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Drive upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
