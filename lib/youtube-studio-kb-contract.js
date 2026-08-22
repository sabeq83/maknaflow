/**
 * lib/youtube-studio-kb-contract.js
 * YouTube Studio Knowledge Base Contract — Fase 3.5A
 * Independent KB types, schema validation, and lifecycle enforcement.
 * No legacy MAKNA Flow KB is imported or referenced.
 */

// ── 1. KB Types ────────────────────────────────────────────────────────────────

export const KB_TYPES = [
  'channel_profile',
  'series_content_guide',
  'longform_editorial_playbook',
  'research_source_policy',
  'visual_continuity_guide',
  'prompt_production_playbook',
  'voice_audio_guide',
  'rights_disclosure_policy',
];

export const KB_SCOPES = ['tenant', 'channel', 'series'];

export const KB_STATUSES = ['draft', 'review', 'active', 'superseded', 'archived'];

// ── 2. Lifecycle Transitions ───────────────────────────────────────────────────

const ALLOWED_TRANSITIONS = {
  draft:      ['review', 'active', 'archived'],
  review:     ['active', 'draft', 'archived'],
  active:     ['superseded', 'archived'],
  superseded: ['archived'],
  archived:   [],
};

export function assertKbTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `KB lifecycle: cannot transition from "${fromStatus}" to "${toStatus}". Allowed: [${allowed.join(', ')}]`
    );
  }
}

// ── 3. Scope-Type Compatibility ────────────────────────────────────────────────

// Which scopes each KB type is valid for
const TYPE_SCOPE_MAP = {
  channel_profile:            ['channel'],
  series_content_guide:       ['series'],
  longform_editorial_playbook:['tenant', 'channel'],
  research_source_policy:     ['tenant', 'channel'],
  visual_continuity_guide:    ['channel', 'series'],
  prompt_production_playbook: ['channel', 'series'],
  voice_audio_guide:          ['channel'],
  rights_disclosure_policy:   ['tenant', 'channel'],
};

export function assertKbTypeScope(kbType, scope) {
  if (!KB_TYPES.includes(kbType)) {
    throw new Error(`Unknown KB type: "${kbType}". Valid types: ${KB_TYPES.join(', ')}`);
  }
  const validScopes = TYPE_SCOPE_MAP[kbType] || [];
  if (!validScopes.includes(scope)) {
    throw new Error(
      `KB type "${kbType}" cannot be scoped to "${scope}". Valid scopes: [${validScopes.join(', ')}]`
    );
  }
}

// ── 4. Per-Type Schema Validation ─────────────────────────────────────────────

function requireString(obj, key, maxLen = 2000) {
  if (!obj[key] || typeof obj[key] !== 'string' || !obj[key].trim()) {
    throw new Error(`KB validation: field "${key}" is required and must be a non-empty string`);
  }
  if (obj[key].length > maxLen) {
    throw new Error(`KB validation: field "${key}" exceeds max length of ${maxLen} characters`);
  }
}

function optionalString(obj, key, maxLen = 4000) {
  if (obj[key] !== undefined && obj[key] !== null) {
    if (typeof obj[key] !== 'string') throw new Error(`KB validation: field "${key}" must be a string if provided`);
    if (obj[key].length > maxLen) throw new Error(`KB validation: field "${key}" exceeds max length of ${maxLen}`);
  }
}

function requireArray(obj, key, minLen = 1, maxItems = 20) {
  if (!Array.isArray(obj[key]) || obj[key].length < minLen) {
    throw new Error(`KB validation: field "${key}" must be a non-empty array`);
  }
  if (obj[key].length > maxItems) {
    throw new Error(`KB validation: field "${key}" exceeds max ${maxItems} items`);
  }
}

const VALIDATORS = {
  channel_profile(content) {
    requireString(content, 'positioning', 1000);
    requireString(content, 'primary_language', 20);
    requireString(content, 'tone', 500);
    requireArray(content, 'target_audience_segments');
    requireArray(content, 'content_pillars');
    optionalString(content, 'cta_patterns', 2000);
    optionalString(content, 'forbidden_claims', 2000);
    optionalString(content, 'monetization_direction', 1000);
    optionalString(content, 'narrative_markdown', 8000);
  },

  series_content_guide(content) {
    requireString(content, 'series_name', 200);
    requireString(content, 'episode_format', 1000);
    requireArray(content, 'recurring_chapters', 1, 30);
    optionalString(content, 'playlist_pattern', 1000);
    optionalString(content, 'content_boundary', 2000);
    optionalString(content, 'narrative_markdown', 8000);
  },

  longform_editorial_playbook(content) {
    requireString(content, 'hook_strategy', 1000);
    requireString(content, 'retention_techniques', 2000);
    requireString(content, 'pacing_notes', 1000);
    optionalString(content, 'open_loop_guidance', 1500);
    optionalString(content, 'cta_architecture', 1500);
    optionalString(content, 'chapter_structure_template', 3000);
    optionalString(content, 'narrative_markdown', 8000);
  },

  research_source_policy(content) {
    requireString(content, 'source_standards', 2000);
    requireString(content, 'claim_confidence_threshold', 500);
    optionalString(content, 'citation_format', 500);
    optionalString(content, 'factual_uncertainty_handling', 1000);
    optionalString(content, 'prohibited_sources', 1000);
    optionalString(content, 'narrative_markdown', 8000);
  },

  visual_continuity_guide(content) {
    optionalString(content, 'character_rules', 2000);
    optionalString(content, 'location_rules', 2000);
    requireString(content, 'visual_grammar', 2000);
    optionalString(content, 'palette_guidance', 1000);
    optionalString(content, 'framing_notes', 1000);
    optionalString(content, 'lighting_notes', 1000);
    optionalString(content, 'drift_prevention', 1000);
    optionalString(content, 'narrative_markdown', 8000);
  },

  prompt_production_playbook(content) {
    requireString(content, 'prompt_grammar', 2000);
    optionalString(content, 'continuity_tokens', 1500);
    optionalString(content, 'negative_prompt_policy', 1500);
    optionalString(content, 't2v_style_guidance', 2000);
    optionalString(content, 'i2v_style_guidance', 2000);
    optionalString(content, 'narrative_markdown', 8000);
  },

  voice_audio_guide(content) {
    requireString(content, 'voice_persona', 1000);
    requireString(content, 'speech_pacing', 500);
    optionalString(content, 'pronunciation_notes', 2000);
    optionalString(content, 'music_sfx_guardrails', 1500);
    optionalString(content, 'narrative_markdown', 8000);
  },

  rights_disclosure_policy(content) {
    requireString(content, 'asset_provenance_requirements', 2000);
    requireString(content, 'disclosure_obligations', 2000);
    optionalString(content, 'archival_policy', 1000);
    optionalString(content, 'reuse_policy', 1000);
    optionalString(content, 'narrative_markdown', 8000);
  },
};

export function validateKnowledgeBase(kbType, content) {
  if (!KB_TYPES.includes(kbType)) {
    throw new Error(`Unknown KB type: "${kbType}"`);
  }
  if (!content || typeof content !== 'object') {
    throw new Error('KB content must be a non-null object');
  }
  VALIDATORS[kbType](content);
  return true;
}

// ── 5. Snapshot Normalization ──────────────────────────────────────────────────

/**
 * Normalize a resolved KB set into a bounded snapshot object for injection into
 * generation prompts. Only relevant fields per stage are extracted.
 */
export function normalizeKbSnapshot(resolvedKbs = [], stage = 'blueprint') {
  const STAGE_TYPE_MAP = {
    blueprint:   ['channel_profile', 'series_content_guide', 'longform_editorial_playbook', 'research_source_policy'],
    script:      ['channel_profile', 'series_content_guide', 'longform_editorial_playbook', 'voice_audio_guide'],
    production:  ['visual_continuity_guide', 'prompt_production_playbook', 'voice_audio_guide'],
  };
  const relevantTypes = STAGE_TYPE_MAP[stage] || KB_TYPES;

  const snapshot = {};
  for (const kb of resolvedKbs) {
    if (relevantTypes.includes(kb.kb_type)) {
      snapshot[kb.kb_type] = {
        revision_id: kb.revision_id,
        scope: kb.scope,
        scope_id: kb.scope_id,
        content: kb.content,
      };
    }
  }
  return snapshot;
}
