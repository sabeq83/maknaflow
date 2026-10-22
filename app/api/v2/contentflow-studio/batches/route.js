import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import {
  createStudioBatch,
  consumePlannerIntoBatch,
  listStudioBatches,
  getStudioBatchById
} from '@/lib/contentflow-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId() || 'default_tenant';
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const batches = await listStudioBatches(tenantId, { status, limit, offset });
    return NextResponse.json({ success: true, data: batches });
  } catch (error) {
    console.error('[ContentFlow Studio Batches GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, context, user) => {
  try {
    let input;
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await request.formData();
      input = JSON.parse(form.get('input') || '{}');
      const image = form.get('productRefImage');
      if (image && typeof image.arrayBuffer === 'function') {
        if (input.engineKind !== 're' || image.size > 10 * 1024 * 1024) throw Object.assign(Error('Upload gambar tidak valid atau terlalu besar.'), { status:400 });
        const sharp = (await import('sharp')).default;
        const buffer = await sharp(Buffer.from(await image.arrayBuffer())).rotate().png().toBuffer();
        const crypto = await import('node:crypto');
        const path = await import('node:path');
        const fs = await import('node:fs/promises');
        const name = crypto.createHash('sha256').update(getActiveTenantId() + ':').update(buffer).digest('hex') + '.png';
        const dir = path.join(process.cwd(),'public','uploads','studio');
        await fs.mkdir(dir,{recursive:true}); await fs.writeFile(path.join(dir,name),buffer);
        input.enginePayload = { ...input.enginePayload, product_ref_image_path:'/uploads/studio/'+name };
      }
    } else input = await request.json();
    const { createStudioBatchAtomically } = await import('@/lib/contentflow-studio-batch-service');
    const data = await createStudioBatchAtomically({ ...input, tenantId: getActiveTenantId(), actorId: user?.id || user?.username });
    return NextResponse.json({ success: true, data }, { status: data.reused ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code || 'STUDIO_BATCH_FAILED', error: error.message }, { status: error.status || 500 });
  }
});
