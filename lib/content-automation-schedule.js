function parts(date, timezone) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { ...values, weekdayIndex: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(values.weekday) };
}

export function isValidTimezone(timezone) {
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); return true; } catch (_) { return false; }
}

export function calculateNextRun({ frequency, config, timezone, after = new Date() }) {
  const targetHour = Number(config.hour ?? 8);
  const targetMinute = Number(config.minute ?? 0);
  const start = new Date(after.getTime() + 60000);
  start.setUTCSeconds(0, 0);
  const limit = frequency === 'monthly' ? 370 : 15;
  for (let minute = 0; minute < limit * 24 * 60; minute++) {
    const candidate = new Date(start.getTime() + minute * 60000);
    const local = parts(candidate, timezone);
    if (Number(local.hour) !== targetHour || Number(local.minute) !== targetMinute) continue;
    if (frequency === 'daily') return candidate;
    if (frequency === 'weekly' && local.weekdayIndex === Number(config.weekday ?? 1)) return candidate;
    if (frequency === 'monthly' && Number(local.day) === Number(config.day_of_month ?? 1)) return candidate;
  }
  throw new Error('Tidak dapat menghitung jadwal berikutnya. Periksa konfigurasi tanggal.');
}

export function calculateOccurrences({ frequency, config, timezone, from, to, limit = 100 }) {
  const end = new Date(to);
  const occurrences = [];
  let cursor = new Date(from);
  while (occurrences.length < limit) {
    const next = calculateNextRun({ frequency, config, timezone, after: cursor });
    if (next > end) break;
    occurrences.push(next);
    cursor = next;
  }
  return occurrences;
}
