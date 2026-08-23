import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  preflightCheck,
  launchEngineCampaign
} from '@/lib/affiliate-studio-launch-adapter';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId } = await params;
    const body = await request.json();
    const { plannerId, rowId, engineType, config } = body;

    if (!plannerId || !rowId || !engineType) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify preflight
    const check = await preflightCheck(user, brandId, programId, plannerId, rowId);
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 });
    }

    // Launch campaign
    const result = await launchEngineCampaign(user, brandId, programId, plannerId, rowId, engineType, config);
    return NextResponse.json({
      success: true,
      message: 'Campaign launched successfully',
      data: result
    });
  } catch (error) {
    console.error('[API /runs/launch Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
