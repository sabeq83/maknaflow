export function updateStudioOutputSchedule(manifest, schedules, outputKey, patch) {
  const output = manifest.find(item=>item.outputKey===outputKey);
  const next = {...schedules,[outputKey]:{...schedules[outputKey],...patch}};
  if (output?.snapshot?.invocationKey && patch.scheduledProductionAt !== undefined) {
    for (const sibling of manifest) if (sibling.snapshot?.invocationKey===output.snapshot.invocationKey) {
      next[sibling.outputKey]={...next[sibling.outputKey],scheduledProductionAt:patch.scheduledProductionAt};
    }
  }
  return next;
}
export function retainStudioOutputSchedules(manifest, previous, defaults) {
  const next={};
  for (const output of manifest) next[output.outputKey]=previous[output.outputKey]||defaults(output);
  return next;
}
