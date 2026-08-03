import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireTenantAdmin } from '@/lib/auth';
import { enqueueExternalNotification } from '@/lib/notification-outbox-repository';

export async function POST(request){try{const user=requireTenantAdmin(request);const item=await enqueueExternalNotification({tenantId:user.tenantId,eventKey:`test:${crypto.randomUUID()}`,eventType:'test',title:'Tes Notifikasi MAKNA',message:'Koneksi Telegram Content Automations berhasil diproses melalui notification outbox.',actionUrl:'/content-automations'});if(!item)return NextResponse.json({success:false,error:'Aktifkan dan simpan Chat ID serta bot token terlebih dahulu.'},{status:409});return NextResponse.json({success:true,outbox_id:item.id,message:'Tes masuk antrean pengiriman.'},{status:202});}catch(e){return NextResponse.json({success:false,error:e.message},{status:e.status||500});}}
