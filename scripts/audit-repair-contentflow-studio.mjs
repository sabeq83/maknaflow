import { pathToFileURL } from 'node:url';
export async function auditStudio({schema, tenantId, apply=false}) {
 if(!['dev','staging'].includes(schema)||!tenantId)throw Error('Schema dev/staging dan --tenant wajib eksplisit.');
 process.env.DISABLE_AUTO_MIGRATIONS='true';
 const {getPgPool}=await import('../lib/db-pg.js');const pool=getPgPool(),c=await pool.connect();
 try{
  await c.query('BEGIN');await c.query(`SET LOCAL search_path TO "${schema}"`);
  const rows=(await c.query(`SELECT b.id batch_id,b.status batch_status,b.engine_kind,s.id slot_id,s.stage_status,s.source_campaign_id,s.source_item_id,
    EXISTS(SELECT 1 FROM content_studio_targets t WHERE t.slot_id=s.id AND t.publishing_job_id IS NOT NULL) has_publishing_job
    FROM content_studio_batches b LEFT JOIN content_studio_slots s ON s.batch_id=b.id AND s.tenant_id=b.tenant_id
    WHERE b.tenant_id=$1 ORDER BY b.id,s.slot_number`,[tenantId])).rows;
  const report=rows.map(r=>({...r,classification:!r.engine_kind?'legacy_requires_review':!r.slot_id?'empty_batch':r.stage_status==='in_progress'&&!r.source_campaign_id?'dispatch_checkpoint_pending':'preserve_and_reconcile'}));
  if(apply){
   // Only quarantine proven legacy. No inferred source mapping and no re-dispatch.
   await c.query("UPDATE content_studio_batches SET status='paused' WHERE tenant_id=$1 AND engine_kind IS NULL AND status='active'",[tenantId]);
   await c.query('UPDATE content_studio_slots s SET legacy_requires_review=true FROM content_studio_batches b WHERE s.batch_id=b.id AND s.tenant_id=$1 AND b.engine_kind IS NULL',[tenantId]);
  }
  console.log(JSON.stringify({schema,tenantId,apply,report},null,2));await c.query(apply?'COMMIT':'ROLLBACK');return report;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const a=process.argv.slice(2),schema=a[a.indexOf('--schema')+1],tenantId=a[a.indexOf('--tenant')+1];if(a.includes('--apply')&&!a.includes(`--confirm-${schema}`))throw Error('Confirmation schema wajib.');await auditStudio({schema,tenantId,apply:a.includes('--apply')});}
