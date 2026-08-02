import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { normalizeContentAutomation } from '@/lib/content-automation-contract';
import { createAutomation, listAutomations, listNotifications, listRuns } from '@/lib/content-automation-repository';
export const dynamic='force-dynamic';
export async function GET(request){try{if(!getCurrentUser(request))return NextResponse.json({success:false,error:'Unauthorized'},{status:401});return NextResponse.json({success:true,schedules:await listAutomations(),runs:await listRuns(),notifications:await listNotifications()});}catch(e){return NextResponse.json({success:false,error:e.message},{status:e.status||500});}}
export async function POST(request){try{const user=getCurrentUser(request);if(!user)return NextResponse.json({success:false,error:'Unauthorized'},{status:401});const data=normalizeContentAutomation(await request.json());return NextResponse.json({success:true,schedule:await createAutomation(data,user.id)},{status:201});}catch(e){return NextResponse.json({success:false,code:e.code,error:e.message},{status:e.status||500});}}
