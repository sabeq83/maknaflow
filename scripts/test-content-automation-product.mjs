import assert from 'node:assert/strict';
import { normalizeContentAutomation } from '../lib/content-automation-contract.js';
import { calculateStartFrameAggregate } from '../lib/start-frame-contract.js';

const base={name:'Product Automation',campaign_kind:'product_campaign',timezone:'Asia/Jakarta',frequency:'weekly',schedule:{weekday:1,hour:8,minute:0},operator_request:{planner:{planner_focus:'product_campaign',brand_id:'b1',product_id:'p1',brand_product_id:'bp1',product_name:'Produk',product_description:'Deskripsi produk lengkap',planner_count:6},selection:{mode:'all'},opc:{preset:'product_campaign_v1',workflow:{approval_mode:'start_frames',auto_sync_contentflow:true}}}};
const value=normalizeContentAutomation(base);
assert.equal(value.campaign_kind,'product_campaign');
assert.equal(value.operator_request.production.scheduler_pause_at,'tts');
assert.equal(value.operator_request.production.preproduction_checkpoint,'start_frames');
assert.throws(()=>normalizeContentAutomation({...base,operator_request:{...base.operator_request,planner:{...base.operator_request.planner,product_id:undefined}}}),/Produk wajib dipilih/);
assert.throws(()=>normalizeContentAutomation({...base,operator_request:{...base.operator_request,planner:{...base.operator_request.planner,planner_count:7}}}),/siklus CEP/);
assert.deepEqual(calculateStartFrameAggregate({visualMode:'hybrid_lock',expectedCount:4,paths:['a','b','c','d']}),{status:'completed',expected:4,completed:4,ready:true});
assert.deepEqual(calculateStartFrameAggregate({visualMode:'hybrid_lock',expectedCount:4,paths:['a','','','']}),{status:'partial',expected:4,completed:1,ready:false});
assert.deepEqual(calculateStartFrameAggregate({visualMode:'pure_t2v',expectedCount:4,paths:[]}),{status:'skipped',expected:0,completed:0,ready:true});
console.log('Content Automation Product Campaign contract tests passed.');
