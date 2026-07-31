import { NextResponse } from 'next/server';
import { getRecommJob, getRecommOutputsForJob, deleteRecommJob } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const job = await getRecommJob(id);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    const outputs = await getRecommOutputsForJob(id);
    return NextResponse.json({ success: true, job, outputs });
  } catch (error) {
    console.error('[API job details GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const job = await getRecommJob(id);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    const outputs = await getRecommOutputsForJob(id);

    // Clean up local images before deleting database rows
    for (const output of outputs) {
      if (output.local_image_path) {
        const fullPath = path.join(process.cwd(), 'public', output.local_image_path);
        if (fs.existsSync(fullPath) && !output.local_image_path.includes('placeholder')) {
          try {
            fs.unlinkSync(fullPath);
          } catch (err) {
            console.error(`[API DELETE Job] Failed to delete image file ${fullPath}:`, err.message);
          }
        }
      }
    }

    // Delete job (will cascade delete outputs in sqlite)
    await deleteRecommJob(id);

    return NextResponse.json({ success: true, message: 'Job and assets deleted successfully' });
  } catch (error) {
    console.error('[API job details DELETE] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
