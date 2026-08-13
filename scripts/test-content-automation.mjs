import assert from 'node:assert/strict';
import { calculateNextRun,calculateOccurrences,isValidTimezone } from '../lib/content-automation-schedule.js';
import { normalizeContentAutomation } from '../lib/content-automation-contract.js';
import { resolveMissedRuns } from '../lib/content-automation-missed-runs.js';
import { calculateBackoff,classifyAutomationError,shouldRetry } from '../lib/content-automation-retry.js';
import { isInQuietHours,nextQuietHoursEnd } from '../lib/content-automation-quiet-hours.js';
import { encryptSecret,decryptSecret } from '../lib/encrypted-secret.js';
import { sendTelegramNotification,TelegramProviderError } from '../lib/notification-providers/telegram.js';
import { normalizeGeneratedPlannerRows } from '../lib/content-planner-contract.js';
import { containsAiDirectiveLeak, sanitizeAiDirectiveLeak } from '../lib/ai-directive.js';

assert.equal(isValidTimezone('Asia/Jakarta'),true);
assert.equal(isValidTimezone('Mars/Olympus'),false);
const weekly=calculateNextRun({frequency:'weekly',config:{weekday:1,hour:8,minute:0},timezone:'Asia/Jakarta',after:new Date('2026-08-02T00:00:00Z')});
assert.equal(weekly.toISOString(),'2026-08-03T01:00:00.000Z');
const monthly=calculateNextRun({frequency:'monthly',config:{day_of_month:3,hour:10,minute:0},timezone:'Asia/Jakarta',after:new Date('2026-08-02T00:00:00Z')});
assert.equal(monthly.toISOString(),'2026-08-03T03:00:00.000Z');
const dailySlots=calculateOccurrences({frequency:'daily',config:{hour:8,minute:0},timezone:'Asia/Jakarta',from:new Date('2026-08-01T00:59:00Z'),to:new Date('2026-08-04T02:00:00Z')});
assert.deepEqual(dailySlots.map(x=>x.toISOString()),['2026-08-01T01:00:00.000Z','2026-08-02T01:00:00.000Z','2026-08-03T01:00:00.000Z','2026-08-04T01:00:00.000Z']);
const now=new Date('2026-08-04T02:00:00Z');
assert.deepEqual(resolveMissedRuns({occurrences:dailySlots,policy:'run_latest',now}).runnableSlots.map(x=>x.toISOString()),['2026-08-04T01:00:00.000Z']);
assert.equal(resolveMissedRuns({occurrences:dailySlots,policy:'catch_up',maxCatchUpRuns:2,now}).runnableSlots.length,2);
assert.equal(resolveMissedRuns({occurrences:dailySlots,policy:'skip',graceMinutes:30,now}).runnableSlots.length,0);
assert.equal(classifyAutomationError({status:429}),'transient');
assert.equal(classifyAutomationError({status:401}),'permanent');
assert.equal(shouldRetry({failureClass:'transient',attempt:2,maxAttempts:3}),true);
assert.equal(shouldRetry({failureClass:'transient',attempt:3,maxAttempts:3}),false);
assert.equal(calculateBackoff({attempt:2,baseSeconds:60,maxSeconds:900,random:()=>0.5}),60);
assert.equal(isInQuietHours({date:new Date('2026-08-03T16:30:00Z'),start:'22:00',end:'07:00',timezone:'Asia/Jakarta'}),true);
assert.equal(isInQuietHours({date:new Date('2026-08-03T06:00:00Z'),start:'22:00',end:'07:00',timezone:'Asia/Jakarta'}),false);
assert.equal(nextQuietHoursEnd({date:new Date('2026-08-03T16:30:00Z'),start:'22:00',end:'07:00',timezone:'Asia/Jakarta'}).toISOString(),'2026-08-04T00:00:00.000Z');
process.env.MAKNA_SECRET_ENCRYPTION_KEY='phase-2b-test-encryption-key';
const cipher=encryptSecret('123456:test_token');
assert.equal(cipher.includes('123456:test_token'),false);
assert.equal(decryptSecret(cipher),'123456:test_token');
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,result:{message_id:42}}),{status:200,headers:{'Content-Type':'application/json'}});
assert.deepEqual(await sendTelegramNotification({botToken:'123456:test_token',chatId:'1',title:'Test',message:'OK',baseUrl:'http://localhost'}),{provider_message_id:'42'});
globalThis.fetch=async()=>new Response(JSON.stringify({ok:false,description:'Unauthorized'}),{status:401,headers:{'Content-Type':'application/json'}});
await assert.rejects(()=>sendTelegramNotification({botToken:'123456:test_token',chatId:'1',title:'Test',message:'No',baseUrl:'http://localhost'}),error=>error instanceof TelegramProviderError&&error.permanent===true);
globalThis.fetch=async()=>new Response(JSON.stringify({ok:false,description:'Too Many Requests'}),{status:429,headers:{'Content-Type':'application/json'}});
await assert.rejects(()=>sendTelegramNotification({botToken:'123456:test_token',chatId:'1',title:'Test',message:'Retry',baseUrl:'http://localhost'}),error=>error instanceof TelegramProviderError&&error.status===429&&error.permanent===false);
globalThis.fetch=async()=>{const error=new Error('aborted');error.name='AbortError';throw error;};
await assert.rejects(()=>sendTelegramNotification({botToken:'123456:test_token',chatId:'1',title:'Test',message:'Timeout',baseUrl:'http://localhost'}),error=>error instanceof TelegramProviderError&&error.message.includes('timeout')&&error.permanent===false);
globalThis.fetch=originalFetch;
const padded=normalizeGeneratedPlannerRows([{hook:'A'}],[{pillar:'P1'},{pillar:'P2'}],2);
assert.equal(padded.length,2);
assert.equal(padded[1].pillar,'P2');
assert.equal(padded[1].sequence,2);
const directive='Konten edukasi brand; jangan membahas produk tertentu.';
const cleaned=sanitizeAiDirectiveLeak({voiceover:[{narration:`CTA natural. ${directive}`}],caption:directive},directive);
assert.equal(cleaned.voiceover[0].narration,'CTA natural.');
assert.equal(cleaned.caption,'');
assert.equal(containsAiDirectiveLeak(cleaned,directive),false);
const normalized=normalizeContentAutomation({name:'Nutribake Weekly',timezone:'Asia/Jakarta',frequency:'weekly',schedule:{weekday:1,hour:8,minute:0},operator_request:{planner:{planner_focus:'brand_editorial',account_name:'nutribake',brand_context:'Edukasi hidup sehat',pillars:['Healthy Breakfast'],planner_count:1,platform:'tiktok'},selection:{mode:'all'},opc:{preset:'nutribake_editorial_v1',workflow:{approval_mode:'storyboard',enable_social_post:false}}}});
assert.equal(normalized.operator_request.production.scheduler_pause_at,'tts');
assert.equal(normalized.operator_request.production.approval_mode,'creative');
assert.equal(normalized.campaign_kind,'brand_editorial');
assert.equal(normalized.operator_request.production.enable_social_post,false);
assert.equal(normalized.missed_run_policy,'skip');
assert.deepEqual(normalized.retry_policy,{max_attempts:3,base_seconds:60,max_seconds:900});
const normalizedNone = normalizeContentAutomation({
  name:'Good',
  timezone:'Asia/Jakarta',
  frequency:'weekly',
  schedule:{weekday:1,hour:8,minute:0},
  operator_request:{
    planner:{planner_focus:'brand_editorial',account_name:'nutribake',brand_context:'Edukasi hidup sehat',pillars:['Healthy Breakfast'],planner_count:1,platform:'tiktok'},
    selection:{mode:'all'},
    opc:{preset:'nutribake_editorial_v1',workflow:{approval_mode:'none',enable_social_post:false}}
  }
});
assert.equal(normalizedNone.operator_request.production.approval_mode, 'none');

assert.throws(()=>normalizeContentAutomation({
  name:'Bad',
  timezone:'Asia/Jakarta',
  frequency:'weekly',
  schedule:{weekday:1,hour:8,minute:0},
  operator_request:{
    planner:{planner_focus:'brand_editorial',account_name:'nutribake',brand_context:'Edukasi hidup sehat',pillars:['Healthy Breakfast'],planner_count:1,platform:'tiktok'},
    selection:{mode:'all'},
    opc:{preset:'nutribake_editorial_v1',workflow:{approval_mode:'invalid_mode',enable_social_post:false}}
  }
}),/creative, start_frames, atau none/);

const normalizedProduct=normalizeContentAutomation({name:'Product Weekly',campaign_kind:'product_campaign',timezone:'Asia/Jakarta',frequency:'weekly',schedule:{weekday:1,hour:8,minute:0},operator_request:{planner:{planner_focus:'product_campaign',brand_id:'brand-1',product_id:'product-1',brand_product_id:'brand-product-1',product_name:'Brownies',product_description:'Brownies sehat tinggi serat',planner_count:6,platform:'tiktok'},selection:{mode:'all'},opc:{preset:'product_campaign_v1',workflow:{approval_mode:'start_frames',auto_sync_contentflow:true,enable_social_post:false}}}});
assert.equal(normalizedProduct.campaign_kind,'product_campaign');
assert.equal(normalizedProduct.product_id,'product-1');
assert.equal(normalizedProduct.operator_request.production.approval_mode,'start_frames');
assert.equal(normalizedProduct.operator_request.production.preproduction_checkpoint,'start_frames');
assert.equal(normalizedProduct.operator_request.production.auto_sync_contentflow,true);
console.log('Content automation schedule and contract tests passed.');
