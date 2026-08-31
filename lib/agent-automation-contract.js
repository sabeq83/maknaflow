export const AGENT_RUN_STATES = Object.freeze({
  SCHEDULED: 'scheduled',
  RESEARCHING: 'researching',
  RESEARCH_READY: 'research_ready',
  PLANNING: 'planning',
  GENERATING: 'generating',
  AWAITING_CREATIVE_APPROVAL: 'awaiting_creative_approval',
  PRODUCING: 'producing',
  READY_TO_PUBLISH: 'ready_to_publish',
  AWAITING_PUBLISH_APPROVAL: 'awaiting_publish_approval',
  PUBLISHING_QUEUED: 'publishing_queued',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  MEASURED: 'measured',
  RESEARCH_FAILED: 'research_failed',
  GENERATION_FAILED: 'generation_failed',
  PRODUCTION_FAILED: 'production_failed',
  PUBLISHING_PREFLIGHT_FAILED: 'publishing_preflight_failed',
  REPLIZ_FAILED: 'repliz_failed',
  PUBLISHING_VERIFICATION_REQUIRED: 'publishing_verification_required'
});

const VALID_TRANSITIONS = {
  [AGENT_RUN_STATES.SCHEDULED]: [AGENT_RUN_STATES.RESEARCHING, AGENT_RUN_STATES.RESEARCH_FAILED],
  [AGENT_RUN_STATES.RESEARCHING]: [AGENT_RUN_STATES.RESEARCH_READY, AGENT_RUN_STATES.RESEARCH_FAILED],
  [AGENT_RUN_STATES.RESEARCH_READY]: [AGENT_RUN_STATES.PLANNING, AGENT_RUN_STATES.GENERATION_FAILED],
  [AGENT_RUN_STATES.PLANNING]: [AGENT_RUN_STATES.GENERATING, AGENT_RUN_STATES.GENERATION_FAILED],
  [AGENT_RUN_STATES.GENERATING]: [
    AGENT_RUN_STATES.AWAITING_CREATIVE_APPROVAL,
    AGENT_RUN_STATES.PRODUCING,
    AGENT_RUN_STATES.GENERATION_FAILED
  ],
  [AGENT_RUN_STATES.AWAITING_CREATIVE_APPROVAL]: [AGENT_RUN_STATES.PRODUCING, AGENT_RUN_STATES.GENERATION_FAILED],
  [AGENT_RUN_STATES.PRODUCING]: [AGENT_RUN_STATES.READY_TO_PUBLISH, AGENT_RUN_STATES.PRODUCTION_FAILED],
  [AGENT_RUN_STATES.READY_TO_PUBLISH]: [
    AGENT_RUN_STATES.AWAITING_PUBLISH_APPROVAL,
    AGENT_RUN_STATES.PUBLISHING_QUEUED,
    AGENT_RUN_STATES.PUBLISHING_PREFLIGHT_FAILED
  ],
  [AGENT_RUN_STATES.AWAITING_PUBLISH_APPROVAL]: [
    AGENT_RUN_STATES.PUBLISHING_QUEUED,
    AGENT_RUN_STATES.PUBLISHING_PREFLIGHT_FAILED
  ],
  [AGENT_RUN_STATES.PUBLISHING_QUEUED]: [AGENT_RUN_STATES.PUBLISHING, AGENT_RUN_STATES.PUBLISHING_PREFLIGHT_FAILED],
  [AGENT_RUN_STATES.PUBLISHING]: [
    AGENT_RUN_STATES.PUBLISHED,
    AGENT_RUN_STATES.REPLIZ_FAILED,
    AGENT_RUN_STATES.PUBLISHING_VERIFICATION_REQUIRED
  ],
  [AGENT_RUN_STATES.PUBLISHED]: [AGENT_RUN_STATES.MEASURED],
  [AGENT_RUN_STATES.MEASURED]: [],
  [AGENT_RUN_STATES.RESEARCH_FAILED]: [AGENT_RUN_STATES.RESEARCHING],
  [AGENT_RUN_STATES.GENERATION_FAILED]: [AGENT_RUN_STATES.RESEARCH_READY, AGENT_RUN_STATES.PLANNING],
  [AGENT_RUN_STATES.PRODUCTION_FAILED]: [AGENT_RUN_STATES.PRODUCING],
  [AGENT_RUN_STATES.PUBLISHING_PREFLIGHT_FAILED]: [AGENT_RUN_STATES.READY_TO_PUBLISH],
  [AGENT_RUN_STATES.REPLIZ_FAILED]: [AGENT_RUN_STATES.PUBLISHING_QUEUED],
  [AGENT_RUN_STATES.PUBLISHING_VERIFICATION_REQUIRED]: [AGENT_RUN_STATES.PUBLISHED, AGENT_RUN_STATES.REPLIZ_FAILED]
};

export function validateAgentRunTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Transisi tidak valid dari ${from} ke ${to}`);
  }
  return true;
}

export function normalizePublishingPolicy(input) {
  const mode = input?.mode || 'draft_only';
  if (!['draft_only', 'approval_required', 'auto_publish'].includes(mode)) {
    throw new Error(`Mode publishing policy tidak valid: ${mode}`);
  }
  const accountIds = Array.isArray(input?.account_ids)
    ? [...new Set(input.account_ids.map(String).map(value => value.trim()).filter(Boolean))]
    : [];
  const platform = String(input?.platform || 'tiktok').trim().toLowerCase();
  const publishTime = String(input?.publish_time || '18:30').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(publishTime)) {
    throw new Error('publishing.publish_time wajib memakai format HH:mm.');
  }
  if (mode !== 'draft_only' && accountIds.length === 0) {
    throw new Error('publishing.account_ids wajib diisi untuk approval_required atau auto_publish.');
  }
  return {
    mode,
    account_ids: accountIds,
    platform,
    publish_time: publishTime,
    timezone: String(input?.timezone || 'Asia/Jakarta').trim(),
    missed_slot_policy: input?.missed_slot_policy === 'publish_when_ready' ? 'publish_when_ready' : 'next_day'
  };
}

export function normalizeResearchRequest(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Konfigurasi research wajib berupa object.');
  }
  const query = String(input.query || '').trim();
  if (!query) throw new Error('research.query wajib diisi.');
  const maxAgeHours = Math.min(168, Math.max(1, Number(input.max_research_age_hours || 24)));
  const productionCount = Number(input.production_count || 1);
  if (!Number.isInteger(productionCount) || productionCount < 1 || productionCount > 30) {
    throw new Error('research.production_count wajib berupa angka 1 sampai 30.');
  }
  return {
    query,
    locale: String(input.locale || 'id-ID').trim(),
    max_research_age_hours: maxAgeHours,
    production_count: productionCount,
    source_policy: String(input.source_policy || 'primary_and_reputable').trim(),
    prohibited_topics: Array.isArray(input.prohibited_topics)
      ? input.prohibited_topics.map(String).map(value => value.trim()).filter(Boolean).slice(0, 30)
      : []
  };
}

export function resolveNextPublishAt({ publishTime, timezone = 'Asia/Jakarta', now = new Date(), missedSlotPolicy = 'next_day' }) {
  const [hour, minute] = publishTime.split(':').map(Number);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const localNowMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const targetMinutes = hour * 60 + minute;
  if (missedSlotPolicy === 'publish_when_ready' && localNowMinutes >= targetMinutes) return now;
  const dayOffset = localNowMinutes >= targetMinutes ? 1 : 0;
  const localNoonUtc = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  localNoonUtc.setUTCDate(localNoonUtc.getUTCDate() + dayOffset);
  const targetDate = localNoonUtc.toISOString().slice(0, 10);
  const [targetYear, targetMonth, targetDay] = targetDate.split('-').map(Number);
  const targetLocalEpoch = Date.UTC(targetYear, targetMonth - 1, targetDay, hour, minute, 0);
  const probe = new Date(targetLocalEpoch);
  const zoned = Object.fromEntries(formatter.formatToParts(probe).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const observedLocalEpoch = Date.UTC(
    Number(zoned.year), Number(zoned.month) - 1, Number(zoned.day),
    Number(zoned.hour), Number(zoned.minute), Number(zoned.second)
  );
  return new Date(probe.getTime() + targetLocalEpoch - observedLocalEpoch);
}
