import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { stageStudioImage } from '@/lib/contentflow-studio-assets';

export const POST = withTenantContext(async request => {
  try {
    const form = await request.formData();
    const result = await stageStudioImage(getActiveTenantId(),form.get('file'));
    return NextResponse.json({success:true,...result});
  } catch(error) {
    return NextResponse.json({success:false,error:error.message},{status:error.status||500});
  }
});
