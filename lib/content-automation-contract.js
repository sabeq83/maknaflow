import { normalizeOperatorContentRequest } from './operator-content-contract.js';
import { calculateNextRun, isValidTimezone } from './content-automation-schedule.js';

export class ContentAutomationError extends Error {
  constructor(message, code = 'CONTENT_AUTOMATION_VALIDATION', status = 400) { super(message); this.code = code; this.status = status; }
}

export function normalizeContentAutomation(input, { existing = null } = {}) {
  const merged = { ...(existing || {}), ...(input || {}) };
  const name = String(merged.name || '').trim();
  if (!name) throw new ContentAutomationError('Nama automation wajib diisi.');
  const timezone = merged.timezone || 'Asia/Jakarta';
  if (!isValidTimezone(timezone)) throw new ContentAutomationError('Timezone IANA tidak valid.');
  const frequency = merged.frequency || 'weekly';
  if (!['daily', 'weekly', 'monthly'].includes(frequency)) throw new ContentAutomationError('Frequency hanya daily, weekly, atau monthly.');
  const schedule = merged.schedule || merged.schedule_config_json || {};
  const hour = Number(schedule.hour ?? 8), minute = Number(schedule.minute ?? 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new ContentAutomationError('Jam schedule tidak valid.');
  if (frequency === 'weekly' && (Number(schedule.weekday) < 0 || Number(schedule.weekday) > 6)) throw new ContentAutomationError('Weekday harus 0 sampai 6.');
  if (frequency === 'monthly' && (Number(schedule.day_of_month) < 1 || Number(schedule.day_of_month) > 28)) throw new ContentAutomationError('Pilot monthly mendukung tanggal 1 sampai 28.');
  const operatorRequest = normalizeOperatorContentRequest(merged.operator_request || merged.operator_request_json || {});
  if (operatorRequest.production.approval_mode !== 'storyboard') throw new ContentAutomationError('Pilot automation wajib memakai approval storyboard.');
  if (operatorRequest.production.enable_social_post) throw new ContentAutomationError('Social posting tidak diizinkan pada automation pilot.');
  const nextRunAt = calculateNextRun({ frequency, config: schedule, timezone, after: new Date() });
  return { name, status: merged.status === 'active' ? 'active' : 'paused', timezone, frequency,
    schedule, operator_request: operatorRequest, missed_run_policy: 'skip',
    grace_minutes: Math.min(1440, Math.max(1, Number(merged.grace_minutes || 60))), next_run_at: nextRunAt };
}
