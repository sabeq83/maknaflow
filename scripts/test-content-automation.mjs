import assert from 'node:assert/strict';
import { calculateNextRun,isValidTimezone } from '../lib/content-automation-schedule.js';
import { normalizeContentAutomation } from '../lib/content-automation-contract.js';
import { normalizeGeneratedPlannerRows } from '../lib/content-planner-contract.js';

assert.equal(isValidTimezone('Asia/Jakarta'),true);
assert.equal(isValidTimezone('Mars/Olympus'),false);
const weekly=calculateNextRun({frequency:'weekly',config:{weekday:1,hour:8,minute:0},timezone:'Asia/Jakarta',after:new Date('2026-08-02T00:00:00Z')});
assert.equal(weekly.toISOString(),'2026-08-03T01:00:00.000Z');
const monthly=calculateNextRun({frequency:'monthly',config:{day_of_month:3,hour:10,minute:0},timezone:'Asia/Jakarta',after:new Date('2026-08-02T00:00:00Z')});
assert.equal(monthly.toISOString(),'2026-08-03T03:00:00.000Z');
const padded=normalizeGeneratedPlannerRows([{hook:'A'}],[{pillar:'P1'},{pillar:'P2'}],2);
assert.equal(padded.length,2);
assert.equal(padded[1].pillar,'P2');
assert.equal(padded[1].sequence,2);
const normalized=normalizeContentAutomation({name:'Nutribake Weekly',timezone:'Asia/Jakarta',frequency:'weekly',schedule:{weekday:1,hour:8,minute:0},operator_request:{planner:{planner_focus:'brand_editorial',account_name:'nutribake',brand_context:'Edukasi hidup sehat',pillars:['Healthy Breakfast'],planner_count:1,platform:'tiktok'},selection:{mode:'all'},opc:{preset:'nutribake_editorial_v1',workflow:{approval_mode:'storyboard',enable_social_post:false}}}});
assert.equal(normalized.operator_request.production.scheduler_pause_at,'tts');
assert.equal(normalized.operator_request.production.enable_social_post,false);
assert.throws(()=>normalizeContentAutomation({
  name:'Bad',
  timezone:'Asia/Jakarta',
  frequency:'weekly',
  schedule:{weekday:1,hour:8,minute:0},
  operator_request:{
    planner:{planner_focus:'brand_editorial',account_name:'nutribake',brand_context:'Edukasi hidup sehat',pillars:['Healthy Breakfast'],planner_count:1,platform:'tiktok'},
    selection:{mode:'all'},
    opc:{preset:'nutribake_editorial_v1',workflow:{approval_mode:'none',enable_social_post:false}}
  }
}),/approval storyboard/);
console.log('Content automation schedule and contract tests passed.');
