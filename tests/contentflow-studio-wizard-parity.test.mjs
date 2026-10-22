import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { captureCanonicalFormData } from '../lib/campaign-configuration/capture.js';
import { validateAndNormalizeEnginePayload, applyStudioExecutionPolicy } from '../lib/campaign-configuration/index.js';
import { buildOutputManifest } from '../lib/contentflow-studio-manifest.js';
import { updateStudioOutputSchedule } from '../lib/contentflow-studio-wizard-steps.js';
const require=createRequire(import.meta.url);
const {parse}=require('next/dist/compiled/babel/parser');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/contentflow-studio-canonical-controls.json',import.meta.url)));
function walk(n,fn){if(!n||typeof n!=='object')return;if(n.type)fn(n);for(const[k,v]of Object.entries(n)){if(['loc','start','end'].includes(k))continue;if(Array.isArray(v))v.forEach(x=>walk(x,fn));else if(v&&typeof v==='object')walk(v,fn);}}
for(const [kind,name]of Object.entries({planner:'Planner',pillar:'Pillar',re:'ReCampaign',multiplier:'Multiplier',recipe:'RecipeLabs'}))test(`Canonical ${kind} preserves every original controlled input and handler`,()=>{
 const s=fs.readFileSync(new URL(`../app/components/campaign-forms/${name}ConfigurationForm.js`,import.meta.url),'utf8');const fields=[];
 walk(parse(s,{sourceType:'module',plugins:['jsx']}),n=>{if(n.type!=='JSXElement'||!['input','select','textarea','VisualIdentitySelector'].includes(n.openingElement.name.name))return;const attrs=Object.fromEntries(n.openingElement.attributes.filter(a=>['value','checked','required','min','max','step','accept','type','onChange','allowLegacyCustom'].includes(a.name?.name)).map(a=>[a.name.name,a.value?s.slice(a.value.start,a.value.end).replace(/\s+/g,' ').trim():true]));fields.push({tag:n.openingElement.name.name,attrs});});
 assert.deepEqual(fields.map(x=>JSON.stringify(x)).sort(),fixture[kind].map(x=>JSON.stringify(x)).sort());
});
test('RE FormData capture retains URLs, identity, nested JSON, files, false and zero',()=>{
 const form=new FormData();for(const[k,v]of Object.entries({campaign_name:'RE Demo',urls:JSON.stringify(['https://example.com/source']),execution_mode:'manual_review',angle_multiplier:'3',enable_social_post:'0',enable_audio_segment:'0',generate_recipe:'0',is_bridging_active:'0',visual_identity_preset_id:'demo-preset',voice_cast_json:JSON.stringify({characters:[]})}))form.append(k,v);
 form.append('product_media',new Blob(['demo'],{type:'image/png'}),'demo.png');
 const capture=captureCanonicalFormData(form);const normalized=validateAndNormalizeEnginePayload('re',capture.config);
 assert.equal(normalized.generate_recipe,0);assert.equal(normalized.enable_social_post,0);assert.equal(normalized.execution_mode,'manual_review');assert.equal(normalized.visual_identity_preset_id,'demo-preset');assert.equal(capture.productRefImage.name,'demo.png');assert.deepEqual(normalized.urls,['https://example.com/source']);
});
test('RE variants preserve bulk source product linkage and share one invocation per source',()=>{
 const sources=[{source_url:'https://example.com/a',product_url:'https://example.com/product-a'},{source_url:'https://example.com/b',product_url:'https://example.com/product-b'}];
 const outputs=buildOutputManifest('re',{campaign_name:'Angles',urls:sources,angle_multiplier:3});
 assert.equal(outputs.length,6);assert.equal(new Set(outputs.map(o=>o.snapshot.invocationKey)).size,2);assert.equal(new Set(outputs.map(o=>o.outputKey)).size,6);
 assert.deepEqual(outputs[4].snapshot.source,sources[1]);
 const reordered=buildOutputManifest('re',{urls:[sources[1],sources[0]],angle_multiplier:3});assert.equal(outputs[0].outputKey,reordered[3].outputKey);
 const schedules=Object.fromEntries(outputs.map(o=>[o.outputKey,{scheduledProductionAt:'old',scheduledPublishAt:'publish'}]));
 const next=updateStudioOutputSchedule(outputs,schedules,outputs[1].outputKey,{scheduledProductionAt:'new'});
 assert.equal(next[outputs[0].outputKey].scheduledProductionAt,'new');assert.equal(next[outputs[2].outputKey].scheduledProductionAt,'new');assert.equal(next[outputs[3].outputKey].scheduledProductionAt,'old');assert.equal(next[outputs[0].outputKey].scheduledPublishAt,'publish');
});
test('All Multiplier workflows retain editorial and product combinations, and reject >20 rows like the source API',()=>{
 for(const mode of ['one_blueprint_multi_angle','multi_blueprint_one_angle','multi_blueprint_one_product','one_blueprint_multi_product']){
  const editorial=mode.includes('angle');const rows=Array.from({length:20},(_,i)=>({deconstruct_asset_id:`bp-${i}`,campaign_type:editorial?'pure_storytelling':'product_campaign',target_product_url:editorial?'':'https://example.com/product'}));
  const config=validateAndNormalizeEnginePayload('multiplier',{mode,rows});assert.equal(buildOutputManifest('multiplier',config).length,20);assert.throws(()=>validateAndNormalizeEnginePayload('multiplier',{mode,rows:[...rows,rows[0]]}));
 }
});
test('Studio publishing policy suppresses every nested draft flag without changing original config',()=>{
 const input={enable_social_post:1,audio_config_json:JSON.stringify({enableSocialPost:true,voiceSpeed:0.8}),shared_config:{audio:{enableSocialPost:true}},config_json:{enable_social_post:true},angle_multiplier:4};const safe=applyStudioExecutionPolicy(input);
 assert.equal(input.enable_social_post,1);assert.equal(JSON.parse(safe.audio_config_json).enableSocialPost,0);assert.equal(JSON.parse(safe.audio_config_json).voiceSpeed,0.8);assert.equal(safe.shared_config.audio.enableSocialPost,0);assert.equal(safe.config_json.enable_social_post,0);assert.equal(safe.angle_multiplier,4);
});
test('Recipe Labs and Planner keep distinct limits; invalid storyboard/config rejected',()=>{
 assert.doesNotThrow(()=>validateAndNormalizeEnginePayload('recipe',{category:'Makanan',nextcloud_parent_folder:'Recipes',target_recipe_count:20}));
 assert.throws(()=>validateAndNormalizeEnginePayload('recipe',{category:'Makanan',target_recipe_count:30}));
 assert.throws(()=>validateAndNormalizeEnginePayload('recipe',{category:'Kuliner',campaign_type:'video',config_json:{},target_recipe_count:1}));
});

test('Stable output keys retain source identity across Multiplier reordering and Recipe count changes',()=>{
 const a={deconstruct_asset_id:'a',campaign_type:'pure_storytelling'},b={deconstruct_asset_id:'b',campaign_type:'pure_storytelling'};
 const first=buildOutputManifest('multiplier',{rows:[a,b]},[],{stableKeys:true});
 const second=buildOutputManifest('multiplier',{rows:[b,a]},[],{stableKeys:true});assert.equal(first[0].outputKey,second[1].outputKey);
 const recipe={category:'Makanan',campaign_type:'static',target_recipe_count:2};
 const one=buildOutputManifest('recipe',recipe,[],{stableKeys:true});const two=buildOutputManifest('recipe',{...recipe,target_recipe_count:3},[],{stableKeys:true});assert.equal(one[0].outputKey,two[0].outputKey);
});
