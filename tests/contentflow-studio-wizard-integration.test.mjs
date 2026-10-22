import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// All DB work uses structure-only copies in a fresh schema; never tenant fixtures in dev/staging/public.
test('Studio canonical config: variant invocation, retry, cardinality and ownership are atomic', {skip:process.env.STUDIO_TEST_DB!=='1'}, async()=>{
 process.env.DISABLE_AUTO_MIGRATIONS='true';process.env.DISABLE_STARTUP_DB_CACHES='true';
 const schema=`studio_test_wizard_${Date.now()}`;process.env.PG_SEARCH_PATH=schema;process.env.PGPOOL_MAX='3';
 const {getPgPool,closePgPool}=await import('../lib/db-pg.js');
 const {createStudioBatchAtomically}=await import('../lib/contentflow-studio-batch-service.js');
 const {dispatchSlotProduction,reconcileSlotProgress}=await import('../lib/contentflow-studio-adapters.js');
 const {buildOutputManifest}=await import('../lib/contentflow-studio-manifest.js');
 const c=await getPgPool().connect(),tenant='studio_fixture_tenant';
 try{
  await c.query(`CREATE SCHEMA "${schema}"`);
  for(const table of ['content_planners','content_planner_rows','publishing_accounts','brand_profiles','re_deconstructed_assets','product_extractions','content_planner_consumptions','content_studio_batches','content_studio_slots','content_studio_targets','content_studio_approvals','content_studio_events','re_campaigns','re_campaign_items','re_multiplier_tasks','recipe_campaigns','recipe_items','pillar_campaigns','pillar_campaign_items','re_item_angle_variants'])await c.query(`CREATE TABLE "${schema}".${table} (LIKE dev.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
  await c.query(`CREATE SEQUENCE "${schema}".test_re_item_seq`);
  await c.query(`ALTER TABLE "${schema}".re_campaign_items ALTER COLUMN id SET DEFAULT nextval('"${schema}".test_re_item_seq')`);
  await c.query(`SET search_path TO "${schema}"`);
  await c.query(`INSERT INTO publishing_accounts(id,tenant_id,platform,provider,display_name,status) VALUES('test_account',$1,'instagram','repliz','Test','active')`,[tenant]);
  const payload={campaign_name:'RE Canonical',execution_mode:'manual_review',urls:[{source_url:'https://example.com/source',product_url:'https://example.com/product'}],angle_multiplier:3,enable_tts:'0',enable_glabs:'0',enable_ffmpeg:'0',generate_recipe:'0',enable_social_post:'1',enable_audio_segment:'1',voice_cast_json:JSON.stringify({characters:[]}),is_bridging_active:'0'};
  const outputs=buildOutputManifest('re',payload,[],{stableKeys:true});
  const base={schemaVersion:3,tenantId:tenant,actorId:'fixture',engineKind:'re',sourceKind:'re_campaign',enginePayload:payload,timezone:'Asia/Jakarta',idempotencyKey:crypto.randomUUID(),outputSchedules:outputs.map((o,n)=>({outputKey:o.outputKey,productionAt:'2026-10-22T01:00:00Z',publishAt:`2026-11-0${n+1}T12:00:00Z`,accountIds:['test_account']}))};
  const batch=await createStudioBatchAtomically(base);assert.equal(batch.slots.length,3);
  assert.equal(batch.configuration_json.enable_social_post,1);assert.equal(batch.configuration_json.generate_recipe,0);
  await assert.rejects(()=>createStudioBatchAtomically({...base,idempotencyKey:crypto.randomUUID(),enginePayload:{...payload,brand_profile_id:'other_tenant_brand'}}),/tenant aktif/);
  await assert.rejects(()=>createStudioBatchAtomically({...base,idempotencyKey:crypto.randomUUID(),enginePayload:{...payload,product_ref_image_path:'/uploads/studio/other-tenant/file.png'}}),/tenant aktif/);
  const reused=await createStudioBatchAtomically(base);assert.equal(reused.id,batch.id);
  await assert.rejects(()=>createStudioBatchAtomically({...base,idempotencyKey:crypto.randomUUID(),outputSchedules:base.outputSchedules.map((s,i)=>({...s,productionAt:i?'2026-10-23T01:00:00Z':s.productionAt}))}),/waktu mulai produksi yang sama/);
  const slot=i=>({...batch.slots[i],batch_engine_kind:'re',batch_config:batch.configuration_json});
  const [first,second]=await Promise.all([dispatchSlotProduction(slot(0)),dispatchSlotProduction(slot(1))]);
  assert.equal(first.campaignId,second.campaignId);assert.equal(first.campaignItemId,second.campaignItemId);
  assert.equal((await c.query('SELECT COUNT(*)::int n FROM re_campaigns')).rows[0].n,1);
  const config=(await c.query('SELECT * FROM re_campaigns')).rows[0];assert.equal(Number(config.enable_social_post),0);assert.equal(config.execution_mode,'manual_review');assert.equal(Number(config.enable_audio_segment),1);
  assert.equal((await c.query('SELECT product_url FROM re_campaign_items')).rows[0].product_url,'https://example.com/product');
  for(let n=0;n<3;n++)await c.query(`INSERT INTO re_item_angle_variants(id,re_item_id,angle_name,angle_category,matrix_strategy_used,system_targeting,voice_persona_assigned,visual_tasks_json,angle_description,ffmpeg_status,upload_status,ffmpeg_output_path) VALUES($1,$2,$3,'promo','fixture','fixture','none','[]',$4,'completed','completed',$5)`,[`fixture_variant_${n}`,first.campaignItemId,`Angle ${n}`,`Caption ${n}`,`/temp/fixture_angle_${n}.mp4`]);
  for(let n=0;n<2;n++){
   const record=(await c.query('SELECT * FROM content_studio_slots WHERE id=$1',[batch.slots[n].id])).rows[0];
   const ready=await reconcileSlotProgress({...record,batch_engine_kind:'re'});assert.equal(ready.status,'ready');
  }
  const mapped=(await c.query('SELECT output_snapshot_json,final_media_url FROM content_studio_slots WHERE stage_status=$1 ORDER BY slot_number',['ready'])).rows;
  assert.notEqual(mapped[0].output_snapshot_json.variantId,mapped[1].output_snapshot_json.variantId);assert.notEqual(mapped[0].final_media_url,mapped[1].final_media_url);
 }finally{await c.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);c.release();await closePgPool();}
});
