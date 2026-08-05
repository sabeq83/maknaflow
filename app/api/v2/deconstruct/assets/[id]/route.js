import { NextResponse } from 'next/server';
import { updateDeconstructAsset } from '@/lib/db';

export const dynamic = 'force-dynamic';

import { withTenantContext } from '@/lib/auth';

export const PUT = withTenantContext(async (req, { params }) => {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.tags === undefined) {
      return NextResponse.json({ success: false, error: 'Field "tags" wajib dikirimkan' }, { status: 400 });
    }

    // updateDeconstructAsset updates database record for this asset id
    await updateDeconstructAsset(id, { tags: body.tags });

    return NextResponse.json({ success: true, message: 'Tags asset berhasil diperbarui' });
  } catch (error) {
    console.error('[Deconstruct Asset API] PUT error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
