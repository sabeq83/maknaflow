import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOutputManifest,validateEngineSource,toZonedInput,zonedInputToIso,createStudioIdempotencyKey} from '../lib/contentflow-studio-manifest.js';

test('Campaign-first: Planner required only by Pillar and rejected by other engines',()=>{
 for(const [engineKind,sourceKind] of [['re','re_campaign'],['multiplier','multiplier_lab'],['recipe','recipe_labs']]){
  assert.doesNotThrow(()=>validateEngineSource({engineKind,sourceKind}));
  assert.throws(()=>validateEngineSource({engineKind,sourceKind,plannerId:'forbidden'}));
 }
 assert.throws(()=>validateEngineSource({engineKind:'pillar',sourceKind:'planner_pillar'}));
 assert.doesNotThrow(()=>validateEngineSource({engineKind:'pillar',sourceKind:'planner_recipe',plannerId:'new'}));
 assert.throws(()=>validateEngineSource({engineKind:'re',sourceKind:'planner_pillar'}));
});
test('Output manifests retain each source instead of replaying rows[0] or all URLs',()=>{
 const re=buildOutputManifest('re',{urls:['https://example.com/a','https://example.com/b']});
 assert.equal(re.length,2);assert.equal(re[1].snapshot.source,'https://example.com/b');
 const mul=buildOutputManifest('multiplier',{rows:[{deconstruct_asset_id:'a',campaign_type:'pure_storytelling',angle_title:'A'},{deconstruct_asset_id:'b',campaign_type:'pure_storytelling',angle_title:'B'}]});
 assert.equal(mul[1].snapshot.row.deconstruct_asset_id,'b');assert.notEqual(mul[0].outputKey,mul[1].outputKey);
 assert.throws(()=>buildOutputManifest('multiplier',{rows:[{campaign_type:'pure_storytelling'}]}));
 const recipe=buildOutputManifest('recipe',{category:'Kue',campaign_type:'static',target_recipe_count:3});
 assert.equal(recipe.length,3);assert.equal(recipe[0].mediaType,'image');
 const pillar=buildOutputManifest('pillar',{},[{id:'row1',hook:'Hook'}]);assert.equal(pillar[0].plannerRowId,'row1');
 assert.throws(()=>buildOutputManifest('missing',{}));
});
test('Timezone round trip retains WIB hours across month boundary',()=>{
 for(const value of ['2026-10-23T19:00','2026-11-01T00:15','2027-01-01T00:00'])assert.equal(toZonedInput(zonedInputToIso(value)),value);
 assert.equal(zonedInputToIso('2026-10-23T19:00'),'2026-10-23T12:00:00.000Z');
 assert.throws(()=>zonedInputToIso('not-a-date'));
});

test('Isolated PostgreSQL: atomic batches, single-use, activation, aliases and dispatch failure', {skip:process.env.STUDIO_TEST_DB!=='1'}, async()=>{
 process.env.DISABLE_AUTO_MIGRATIONS='true';process.env.DISABLE_STARTUP_DB_CACHES='true';
 const schema=`studio_test_${Date.now()}`;process.env.PG_SEARCH_PATH=schema;process.env.PGPOOL_MAX='3';
 const {getPgPool,pgQuery,closePgPool}=await import('../lib/db-pg.js');
 const {campaignFirstDDL}=await import('../scripts/migrate-contentflow-studio-campaign-first.mjs');
 const {createStudioBatchAtomically}=await import('../lib/contentflow-studio-batch-service.js');
 const {claimDueStudioSlot,getCalendarProjection}=await import('../lib/contentflow-studio-repository.js');
 const c=await getPgPool().connect();
 const tenant='studio_fixture_tenant';
 try{
  await c.query(`CREATE SCHEMA "${schema}"`);
  // Copy structure only, never data or background workers. All fixtures live in isolated schema.
  for(const table of ['content_planners','content_planner_rows','publishing_accounts','brand_profiles','re_deconstructed_assets','product_extractions','content_planner_consumptions','content_studio_batches','content_studio_slots','content_studio_targets','content_studio_approvals','content_studio_events','re_campaigns','re_campaign_items','re_multiplier_tasks','recipe_campaigns','recipe_items','pillar_campaigns','pillar_campaign_items'])await c.query(`CREATE TABLE "${schema}".${table} (LIKE dev.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
  await c.query(`CREATE SEQUENCE "${schema}".test_re_item_seq`);
  await c.query(`ALTER TABLE "${schema}".re_campaign_items ALTER COLUMN id SET DEFAULT nextval('"${schema}".test_re_item_seq')`);
  await c.query(`CREATE SEQUENCE "${schema}".test_pillar_item_seq`);
  await c.query(`ALTER TABLE "${schema}".pillar_campaign_items ALTER COLUMN id SET DEFAULT nextval('"${schema}".test_pillar_item_seq')`);
  await c.query(`SET search_path TO "${schema}"`);await c.query(campaignFirstDDL);
  await c.query(`INSERT INTO publishing_accounts(id,tenant_id,platform,provider,display_name,status) VALUES('test_account',$1,'instagram','repliz','Test','active')`,[tenant]);
  const past=new Date(Date.now()-60000).toISOString(),future=new Date(Date.now()+86400000).toISOString();
  const schedules=outputs=>outputs.map(o=>({outputKey:o.outputKey,productionAt:past,publishAt:future,accountIds:['test_account']}));
  const make=async(engineKind,sourceKind,enginePayload,plannerId=null)=>{
   let rows=[];if(plannerId)rows=[{id:'test_row',hook:'Test'}];
   const outputSchedules=schedules(buildOutputManifest(engineKind,enginePayload.global_settings||enginePayload,rows));
   return {tenantId:tenant,actorId:'test',engineKind,sourceKind,enginePayload,plannerId,outputSchedules,idempotencyKey:`key_${engineKind}`,title:'Test'};
  };
  const reInput=await make('re','re_campaign',{urls:['https://example.com/reference']});
  const [a,b]=await Promise.all([createStudioBatchAtomically(reInput),createStudioBatchAtomically(reInput)]);
  assert.equal(a.id,b.id);assert.equal(a.slots[0].stage_status,'draft');assert.equal(a.slots[0].source_kind,'re_campaign');
  assert.equal(await claimDueStudioSlot('test',tenant),null);
  await assert.rejects(createStudioBatchAtomically({...reInput,title:'Changed'}),e=>e.code==='STUDIO_IDEMPOTENCY_CONFLICT');
  await c.query(`INSERT INTO re_deconstructed_assets(id,tenant_id,source_url) VALUES('test_asset',$1,'https://example.com/source')`,[tenant]);
  const mul=await createStudioBatchAtomically(await make('multiplier','multiplier_lab',{rows:[{deconstruct_asset_id:'test_asset',campaign_type:'pure_storytelling'}]}));assert.equal(mul.slots.length,1);
  const recipe=await createStudioBatchAtomically(await make('recipe','recipe_labs',{category:'Kue',campaign_type:'static',target_recipe_count:2}));assert.equal(recipe.slots[0].output_media_type,'image');
  await c.query("INSERT INTO content_planners(id,tenant_id,title,status,planner_focus) VALUES('test_planner',$1,'Test','completed','brand_editorial')",[tenant]);
  await c.query("INSERT INTO content_planner_rows(id,planner_id,sequence,pillar,hook,visual_action) VALUES('test_row','test_planner',1,'Edukasi','Test','Visual test')");
  const pi=await make('pillar','planner_pillar',{global_settings:{},selected_row_ids:['test_row']},'test_planner');
  const pillar=await createStudioBatchAtomically(pi);assert.equal(pillar.slots.length,1);
  await assert.rejects(createStudioBatchAtomically({...pi,idempotencyKey:'second-consumer'}));
  const before=(await c.query('SELECT COUNT(*)::int n FROM content_studio_batches')).rows[0].n;
  await assert.rejects(createStudioBatchAtomically({...reInput,idempotencyKey:'bad_account',outputSchedules:[{...reInput.outputSchedules[0],accountIds:['other_tenant_account']}]}));
  assert.equal((await c.query('SELECT COUNT(*)::int n FROM content_studio_batches')).rows[0].n,before);
  await c.query("UPDATE content_studio_batches SET status='active' WHERE id=$1",[a.id]);
  await c.query("UPDATE content_studio_slots SET stage_status='pending',activation_status='active' WHERE batch_id=$1",[a.id]);
  const claimed=await claimDueStudioSlot('worker_a',tenant);assert.equal(claimed.batch_engine_kind,'re');assert.equal(claimed.source_kind,'re_campaign');
  assert.equal(await claimDueStudioSlot('worker_b',tenant),null);
  const {dispatchSlotProduction}=await import('../lib/contentflow-studio-adapters.js');
  await assert.rejects(dispatchSlotProduction({...claimed,batch_engine_kind:'unknown'}),e=>e.code==='STUDIO_ENGINE_UNSUPPORTED');
  const dispatch=await dispatchSlotProduction(claimed);
  assert.ok(dispatch.campaignId);assert.ok(dispatch.campaignItemId);
  const retry=await dispatchSlotProduction(claimed);assert.equal(retry.campaignId,dispatch.campaignId);
  assert.equal((await c.query('SELECT COUNT(*)::int n FROM re_campaigns')).rows[0].n,1);
  assert.equal((await c.query('SELECT COUNT(*)::int n FROM re_campaign_items')).rows[0].n,1);
  for(const batch of [mul,pillar,recipe]){
   await c.query("UPDATE content_studio_batches SET status='active' WHERE id=$1",[batch.id]);
   await c.query("UPDATE content_studio_slots SET stage_status='pending',activation_status='active' WHERE batch_id=$1",[batch.id]);
   const task=await claimDueStudioSlot('worker',tenant);
   assert.ok(task);const res=await dispatchSlotProduction(task);assert.ok(res.campaignItemId);
   const again=await dispatchSlotProduction(task);assert.equal(again.campaignId,res.campaignId);
   if(batch.id===recipe.id){ // second image remains scheduled in the future
    await c.query("UPDATE content_studio_slots SET scheduled_production_at=$2 WHERE batch_id=$1 AND stage_status='pending'",[batch.id,future]);
    assert.equal(await claimDueStudioSlot('future-worker',tenant),null);
   }
  }
  const calendar=await getCalendarProjection(tenant);assert.equal(calendar.find(s=>s.batch_id===a.id).source_kind,'re_campaign');
  assert.equal((await pgQuery('SELECT COUNT(*)::int n FROM content_planner_consumptions')).rows[0].n,1);
 }finally{await c.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);c.release();await closePgPool();}
});

test('Wizard idempotency key works on HTTP without secure-context randomUUID',()=>{
 const httpCrypto={getRandomValues:bytes=>{bytes.fill(42);return bytes;}};
 assert.match(createStudioIdempotencyKey(httpCrypto),/^studio_[a-f0-9]{32}$/);
 assert.match(createStudioIdempotencyKey({...httpCrypto,randomUUID:()=>{throw Error('insecure context');}}),/^studio_[a-f0-9]{32}$/);
 assert.equal(createStudioIdempotencyKey({randomUUID:()=> 'secure-uuid'}),'secure-uuid');
 const keys=new Set(Array.from({length:1000},()=>createStudioIdempotencyKey(null)));
 assert.equal(keys.size,1000);
 assert.doesNotThrow(()=>createStudioIdempotencyKey({getRandomValues:()=>{throw Error('blocked');}}));
});
