import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { pgQuery, withPgTransaction } from '@/lib/db-pg';
import { computeApprovalRevisionHash } from '@/lib/contentflow-studio-contract';
import { recordStudioApproval } from '@/lib/contentflow-studio-repository';
import { resumeApprovedStudioPublishing } from '@/lib/contentflow-studio-publishing';
export const dynamic = 'force-dynamic';
export const POST = withTenantContext(async (request, context, user) => {
 try {
  const tenantId=getActiveTenantId(), {id}=await context.params, body=await request.json();
  if(!['schedule','now','manual_evidence'].includes(body.publishMode)) throw Object.assign(Error('Mode publikasi tidak valid.'),{status:400});
  const intent=await withPgTransaction(async client=>{
   const slot=(await client.query('SELECT * FROM content_studio_slots WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[id,tenantId])).rows[0];
   if(!slot)throw Object.assign(Error('Slot tidak ditemukan.'),{status:404});
   if(slot.stage_status!=='ready'||!slot.final_media_url||!slot.contentflow_id)throw Object.assign(Error('Aset akhir belum siap.'),{status:409});
   const targets=(await client.query('SELECT * FROM content_studio_targets WHERE slot_id=$1 AND tenant_id=$2 ORDER BY account_id FOR UPDATE',[id,tenantId])).rows;
   if(!targets.length)throw Object.assign(Error('Akun tujuan belum dipilih.'),{status:400});
   const expected=computeApprovalRevisionHash({mediaUrl:slot.final_media_url,caption:slot.final_caption,accountIds:targets.map(t=>t.account_id),scheduledPublishAt:slot.scheduled_publish_at});
   if(body.clientRevisionHash!==expected)throw Object.assign(Error('Revisi berubah. Buka kembali detail konten.'),{status:409});
   const caption=body.customCaption ?? slot.final_caption;
   const revision=computeApprovalRevisionHash({mediaUrl:slot.final_media_url,caption,accountIds:targets.map(t=>t.account_id),scheduledPublishAt:slot.scheduled_publish_at});
   const active=targets.some(t=>t.approved_at || t.publishing_job_id || ['published','manual_published'].includes(t.status));
   if(active&&revision!==slot.revision_hash)throw Object.assign(Error('Jadwal aktif harus direkonsiliasi sebelum revisi baru.'),{status:409});
   if(body.publishMode==='manual_evidence'){
    try{if(!['http:','https:'].includes(new URL(body.manualEvidenceUrl).protocol))throw Error();}catch{throw Object.assign(Error('Permalink bukti wajib valid.'),{status:400});}
    await client.query("UPDATE content_studio_targets SET status='manual_published',published_at=CURRENT_TIMESTAMP,manual_evidence_json=$3::jsonb WHERE slot_id=$1 AND tenant_id=$2 AND publishing_job_id IS NULL",[id,tenantId,JSON.stringify({url:body.manualEvidenceUrl,actor:user.id})]);
   }else{
    if(body.publishMode==='schedule'&&new Date(slot.scheduled_publish_at)<=new Date())throw Object.assign(Error('Jadwal terlewat. Ubah jadwal atau pilih Publikasikan Sekarang.'),{status:409});
    // Freeze target times on the first intent; retries use the same times/idempotency.
    await client.query(`UPDATE content_studio_targets SET status='scheduling',approval_revision=$3,approved_by=$4,
      scheduled_at=CASE WHEN approved_at IS NULL AND $5='now' THEN CURRENT_TIMESTAMP ELSE scheduled_at END,
      approved_at=COALESCE(approved_at,CURRENT_TIMESTAMP) WHERE slot_id=$1 AND tenant_id=$2 AND publishing_job_id IS NULL AND status NOT IN ('published','manual_published')`,[id,tenantId,revision,user.id,body.publishMode]);
   }
   if(slot.revision_hash!==revision) await recordStudioApproval({slotId:id,tenantId,revisionHash:revision,actor:user.id});
   await client.query('UPDATE content_studio_slots SET revision_hash=$3,final_caption=$4 WHERE id=$1 AND tenant_id=$2',[id,tenantId,revision,caption]);
   return {...slot,final_caption:caption,targets};
  });
  if(body.publishMode!=='manual_evidence') await resumeApprovedStudioPublishing(tenantId,id);
  return NextResponse.json({success:true});
 }catch(e){return NextResponse.json({success:false,error:e.message,code:e.code},{status:e.status||500});}
});
