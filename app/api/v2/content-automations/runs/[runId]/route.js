import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { purgeRun } from '@/lib/content-automation-repository';
export async function DELETE(request,{params}){try{const user=getCurrentUser(request);if(!user||user.role!=='admin')return NextResponse.json({success:false,error:'Hanya Admin tenant yang dapat menghapus run.'},{status:user?403:401});const {runId}=await params;return NextResponse.json({success:true,run:await purgeRun(runId,{actor:user.id})});}catch(e){return NextResponse.json({success:false,error:e.message},{status:e.status||500});}}
