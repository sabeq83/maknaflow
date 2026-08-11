import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { resolveAffiliateLink } from '@/lib/affiliate-resolver';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v2/affiliate-links/resolve
 * Melakukan simulasi resolusi link affiliate produk berdasarkan prioritas (precedence)
 */
export const POST = withTenantContext(async (req) => {
  try {
    const body = await req.json();
    const { brandProfileId, productId, explicitOverride } = body;
    const tenantId = getActiveTenantId();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Parameter productId wajib diisi.' },
        { status: 400 }
      );
    }

    const resolution = await resolveAffiliateLink({
      tenantId,
      brandProfileId,
      productId,
      explicitOverride,
      allowLegacyFallback: true
    });

    return NextResponse.json({ success: true, data: resolution });
  } catch (err) {
    console.error('[POST Resolve Affiliate API Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
});
