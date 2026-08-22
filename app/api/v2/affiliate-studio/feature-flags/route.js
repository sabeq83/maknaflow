import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  getAffiliateStudioFlags,
  saveAffiliateStudioFlags
} from '@/lib/affiliate-studio-feature-flags';
import { recordAffiliateStudioAuditEvent } from '@/lib/affiliate-studio-audit';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (_request, _context, user) => {
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    );
  }
  try {
    const flags = await getAffiliateStudioFlags(user.tenantId);
    return NextResponse.json({ success: true, data: flags });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
});

export const PUT = withTenantContext(async (request, _context, user) => {
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    );
  }
  try {
    const body = await request.json();
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Request body must be an object' },
        { status: 400 }
      );
    }
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== 'enabled') {
      return NextResponse.json(
        { success: false, error: 'Request body must contain only the "enabled" field' },
        { status: 400 }
      );
    }
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '"enabled" field must be a boolean' },
        { status: 400 }
      );
    }

    const previous = await getAffiliateStudioFlags(user.tenantId);
    const result = await saveAffiliateStudioFlags({ enabled: body.enabled }, user);

    await recordAffiliateStudioAuditEvent({
      tenantId: user.tenantId,
      actorUserId: user.id,
      eventType: 'affiliate_studio.feature_flag_updated',
      event: {
        previous,
        current: result
      }
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
});
