import pg from 'pg';
import { loadStagingEnv } from './local-staging/env.js';
import { sanitizeAiDirectiveLeak, containsAiDirectiveLeak } from '../lib/ai-directive.js';

const campaignId=process.argv[2];
if(!campaignId)throw new Error('Gunakan: node scripts/repair-ai-directive-leak.mjs <campaign_id>');
const env=loadStagingEnv(),client=new pg.Client({host:env.PGHOST,port:Number(env.PGPORT),user:env.PGUSER,password:env.PGPASSWORD,database:env.PGDATABASE});
await client.connect();
try{
  await client.query('BEGIN');
  await client.query('ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS ai_directive TEXT');
  await client.query('ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS mandatory_outro_line TEXT');
  const campaign=(await client.query('SELECT id,status,custom_instruction,ai_directive FROM pillar_campaigns WHERE id=$1 FOR UPDATE',[campaignId])).rows[0];
  if(!campaign)throw new Error('Campaign tidak ditemukan.');
  if(campaign.status!=='running')throw new Error(`Campaign status ${campaign.status}; reparasi hanya untuk campaign aktif/awaiting review.`);
  const directive=campaign.ai_directive||campaign.custom_instruction||'';
  if(!directive)throw new Error('Campaign tidak memiliki directive untuk direparasi.');
  const rows=(await client.query('SELECT id,result_json,new_video_plan_json,original_voiceover,tiktok_safe_voiceover FROM pillar_campaign_items WHERE campaign_id=$1 ORDER BY id FOR UPDATE',[campaignId])).rows;
  let repaired=0;
  for(const row of rows){const fields={};for(const key of ['result_json','new_video_plan_json','original_voiceover','tiktok_safe_voiceover']){if(!row[key])continue;const parsed=typeof row[key]==='string'?JSON.parse(row[key]):row[key],cleaned=sanitizeAiDirectiveLeak(parsed,directive);if(JSON.stringify(parsed)!==JSON.stringify(cleaned)){fields[key]=JSON.stringify(cleaned);repaired++;}if(containsAiDirectiveLeak(cleaned,directive))throw new Error(`Directive masih bocor pada item ${row.id}.${key}`);}const entries=Object.entries(fields);if(entries.length){const values=entries.map(([,v])=>v);values.push(row.id);await client.query(`UPDATE pillar_campaign_items SET ${entries.map(([k],i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${values.length}`,values);}}
  await client.query("UPDATE pillar_campaigns SET ai_directive=$1,mandatory_outro_line='',custom_instruction='' WHERE id=$2",[directive,campaignId]);
  await client.query('COMMIT');
  console.log(JSON.stringify({campaign_id:campaignId,item_count:rows.length,repaired_fields:repaired,directive_leak:false},null,2));
}catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
