import { calculateOccurrences } from './content-automation-schedule.js';
import { getAutomationRunHealth,listCalendarRuns,listCalendarSchedules } from './content-automation-repository.js';

const parseJson=value=>typeof value==='string'?JSON.parse(value):value;

export async function getAutomationCalendar({from,to,timezone,scheduleId=null,brandId=null,statuses=[]}) {
  const schedules=await listCalendarSchedules({scheduleId,brandId});
  const runs=await listCalendarRuns({from,to,scheduleId,brandId,statuses});
  const actualKeys=new Set(runs.map(run=>`${run.schedule_id}:${new Date(run.scheduled_for).toISOString()}`));
  const virtual=[];
  if(!statuses.length||statuses.includes('scheduled')){
    for(const schedule of schedules.filter(item=>item.status==='active')){
      const request=parseJson(schedule.operator_request_json)||{};
      const occurrences=calculateOccurrences({frequency:schedule.frequency,config:parseJson(schedule.schedule_config_json),timezone:schedule.timezone,from:new Date(new Date(from).getTime()-60000),to,limit:100});
      for(const date of occurrences){
        const key=`${schedule.id}:${date.toISOString()}`;
        if(!actualKeys.has(key))virtual.push({id:`scheduled:${key}`,source:'schedule',schedule_id:schedule.id,schedule_name:schedule.name,scheduled_for:date.toISOString(),status:'scheduled',timezone:schedule.timezone,brand_id:request.planner?.brand_id||null,brand_account:request.planner?.account_name||'',action_url:null});
      }
    }
  }
  const actual=runs.map(run=>({...run,source:'run',scheduled_for:new Date(run.scheduled_for).toISOString(),action_url:run.operator_campaign_id?`/pillar-campaigns/${run.operator_campaign_id}`:null}));
  return {timezone,from:new Date(from).toISOString(),to:new Date(to).toISOString(),events:[...virtual,...actual].sort((a,b)=>a.scheduled_for.localeCompare(b.scheduled_for)),health:await getAutomationRunHealth()};
}
