export function resolveMissedRuns({ occurrences, policy = 'skip', graceMinutes = 60, maxCatchUpRuns = 3, now = new Date() }) {
  const due = occurrences.filter(slot => slot <= now);
  if (!due.length) return { runnableSlots: [], skippedSlots: [] };
  if (policy === 'catch_up') {
    const limit = Math.max(1, Number(maxCatchUpRuns) || 3);
    return { runnableSlots: due.slice(0, limit), skippedSlots: due.slice(limit) };
  }
  if (policy === 'run_latest') return { runnableSlots: due.slice(-1), skippedSlots: due.slice(0, -1) };
  const latest = due[due.length - 1];
  const withinGrace = now.getTime() - latest.getTime() <= Math.max(1, Number(graceMinutes) || 60) * 60000;
  return { runnableSlots: withinGrace ? [latest] : [], skippedSlots: withinGrace ? due.slice(0, -1) : due };
}
