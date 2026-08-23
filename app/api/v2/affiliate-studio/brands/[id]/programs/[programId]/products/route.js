import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import {
  addProductsToCampaignProgram,
  removeProductsFromCampaignProgram
} from '@/lib/affiliate-studio-campaign-program-adapter';

export const dynamic = 'force-dynamic';

export const POST = withAffiliateStudioAccess('write', async (request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  const programId = params?.programId;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const productIds = body.productIds;
  if (!Array.isArray(productIds)) {
    return NextResponse.json({ success: false, error: 'productIds must be an array' }, { status: 400 });
  }

  const ok = await addProductsToCampaignProgram(user, brandId, programId, productIds);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Failed to add products to program or unauthorized' }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: { success: true } });
});

export const DELETE = withAffiliateStudioAccess('write', async (request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  const programId = params?.programId;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const productIds = body.productIds;
  if (!Array.isArray(productIds)) {
    return NextResponse.json({ success: false, error: 'productIds must be an array' }, { status: 400 });
  }

  const ok = await removeProductsFromCampaignProgram(user, brandId, programId, productIds);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Failed to remove products from program' }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: { success: true } });
});
