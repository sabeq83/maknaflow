import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { previewRunHistoryPurge,purgeRunHistory } from '@/lib/content-automation-repository';
function admin(request){const user=getCurrentUser(request);if(!user||user.role!=='admin'){const e=new Error('Hanya Admin tenant yang dapat menghapus run history.');e.status=user?403:401;throw e;}return user;}
export async function POST(request){try{admin(request);return NextResponse.json({success:true,preview:await previewRunHistoryPurge(await request.json())});}catch(e){return NextResponse.json({success:false,error:e.message},{status:e.status||500});}}
export async function DELETE(request){try{const user=admin(request),body=await request.json();return NextResponse.json({success:true,result:await purgeRunHistory(body.filters||{},{actor:user.id,previewToken:body.preview_token})});}catch(e){return NextResponse.json({success:false,error:e.message},{status:e.status||500});}}
