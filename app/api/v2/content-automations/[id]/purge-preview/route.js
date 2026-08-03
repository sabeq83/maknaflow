import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { previewSchedulePurge } from '@/lib/content-automation-repository';
export const dynamic='force-dynamic';
export async function POST(request,{params}){try{const user=getCurrentUser(request);if(!user||user.role!=='admin')return NextResponse.json({success:false,error:'Hanya Admin tenant yang dapat menghapus schedule.'},{status:user?403:401});const {id}=await params,preview=await previewSchedulePurge(id);return preview?NextResponse.json({success:true,preview}):NextResponse.json({success:false,error:'Schedule tidak ditemukan.'},{status:404});}catch(e){return NextResponse.json({success:false,error:e.message},{status:e.status||500});}}
