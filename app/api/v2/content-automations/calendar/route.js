import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isValidTimezone } from '@/lib/content-automation-schedule';
import { getAutomationCalendar } from '@/lib/content-automation-calendar';

export const dynamic='force-dynamic';
const ALLOWED_STATUSES=new Set(['scheduled','queued','dispatching','retry_wait','job_created','awaiting_approval','producing','completed','failed','skipped']);

export async function GET(request){
  try{
    if(!getCurrentUser(request))return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    const query=new URL(request.url).searchParams,from=new Date(query.get('from')),to=new Date(query.get('to'));
    const timezone=query.get('timezone')||'Asia/Jakarta';
    if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||to<=from)return NextResponse.json({success:false,error:'Rentang kalender tidak valid.'},{status:400});
    if(to-from>62*86400000)return NextResponse.json({success:false,error:'Rentang kalender maksimal 62 hari.'},{status:400});
    if(!isValidTimezone(timezone))return NextResponse.json({success:false,error:'Timezone tidak valid.'},{status:400});
    const statuses=(query.get('status')||'').split(',').filter(Boolean);
    if(statuses.some(status=>!ALLOWED_STATUSES.has(status)))return NextResponse.json({success:false,error:'Filter status tidak valid.'},{status:400});
    const result=await getAutomationCalendar({from,to,timezone,scheduleId:query.get('schedule_id')||null,brandId:query.get('brand_id')||null,statuses});
    return NextResponse.json({success:true,...result});
  }catch(error){return NextResponse.json({success:false,error:error.message},{status:error.status||500});}
}
