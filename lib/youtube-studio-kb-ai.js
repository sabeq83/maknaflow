/**
 * lib/youtube-studio-kb-ai.js
 * YouTube Studio KB AI Drafting Service — Fase 3.5A
 * Generates and refines KB drafts using Gemini AI.
 * Draft always requires user review/activation before becoming active.
 * No legacy MAKNA Flow KB is imported or referenced.
 */

import { callGeminiAPI } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import {
  KB_TYPES,
  validateKnowledgeBase,
  assertKbTypeScope,
} from './youtube-studio-kb-contract.js';

// ── Prompt Templates per KB type ───────────────────────────────────────────────

function buildDraftPrompt({ kbType, scope, brief, locale = 'id-ID' }) {
  const typeDescriptions = {
    channel_profile: `channel_profile JSON schema:
{
  "positioning": "A concise statement defining the channel's unique value proposition (REQUIRED, must not be empty)",
  "primary_language": "The main language of the channel, e.g., 'id-ID' (REQUIRED)",
  "tone": "Editorial tone of the channel, e.g., 'Friendly yet educational' (REQUIRED)",
  "target_audience_segments": ["Segment 1", "Segment 2"], // Array of strings (REQUIRED, min 1 item)
  "content_pillars": ["Pillar 1", "Pillar 2"], // Array of strings (REQUIRED, min 1 item)
  "cta_patterns": "Optional CTA patterns/suggestions (Optional)",
  "forbidden_claims": "Optional forbidden claims/rules (Optional)",
  "monetization_direction": "Optional monetization directions (Optional)",
  "narrative_markdown": "Optional narrative markdown format overview (Optional)"
}`,
    series_content_guide: `series_content_guide JSON schema:
{
  "series_name": "Name of the series (REQUIRED)",
  "episode_format": "Overall format of each episode (REQUIRED)",
  "recurring_chapters": ["Chapter 1", "Chapter 2"], // Array of strings (REQUIRED, min 1 item)
  "playlist_pattern": "Optional playlist naming pattern (Optional)",
  "content_boundary": "Optional content boundaries/topics to avoid (Optional)",
  "narrative_markdown": "Optional narrative markdown summary (Optional)"
}`,
    longform_editorial_playbook: `longform_editorial_playbook JSON schema:
{
  "hook_strategy": "Hook strategy description (REQUIRED)",
  "retention_techniques": "Audience retention techniques (REQUIRED)",
  "pacing_notes": "Pacing rules (REQUIRED)",
  "open_loop_guidance": "Optional open loop guidelines (Optional)",
  "cta_architecture": "Optional CTA placement rules (Optional)",
  "chapter_structure_template": "Optional chapter template (Optional)",
  "narrative_markdown": "Optional narrative markdown template (Optional)"
}`,
    research_source_policy: `research_source_policy JSON schema:
{
  "source_standards": "Source verification standards (REQUIRED)",
  "claim_confidence_threshold": "Claim confidence threshold (REQUIRED)",
  "citation_format": "Optional citation format specification (Optional)",
  "factual_uncertainty_handling": "Optional factual uncertainty guidelines (Optional)",
  "prohibited_sources": "Optional prohibited sources list (Optional)",
  "narrative_markdown": "Optional narrative markdown summary (Optional)"
}`,
    visual_continuity_guide: `visual_continuity_guide JSON schema:
{
  "visual_grammar": "Visual grammar/style rules (REQUIRED)",
  "character_rules": "Optional character consistency rules (Optional)",
  "location_rules": "Optional location consistency rules (Optional)",
  "palette_guidance": "Optional color palette rules (Optional)",
  "framing_notes": "Optional camera framing notes (Optional)",
  "lighting_notes": "Optional lighting notes (Optional)",
  "drift_prevention": "Optional visual drift prevention notes (Optional)",
  "narrative_markdown": "Optional narrative markdown summary (Optional)"
}`,
    prompt_production_playbook: `prompt_production_playbook JSON schema:
{
  "prompt_grammar": "Prompt grammar/style rules (REQUIRED)",
  "continuity_tokens": "Optional visual continuity tokens (Optional)",
  "negative_prompt_policy": "Optional negative prompt rules (Optional)",
  "t2v_style_guidance": "Optional T2V model style guidelines (Optional)",
  "i2v_style_guidance": "Optional I2V model style guidelines (Optional)",
  "narrative_markdown": "Optional narrative markdown summary (Optional)"
}`,
    voice_audio_guide: `voice_audio_guide JSON schema:
{
  "voice_persona": "Voice/narrator persona description (REQUIRED)",
  "speech_pacing": "Narrator speech pacing rules (REQUIRED)",
  "pronunciation_notes": "Optional pronunciation notes (Optional)",
  "music_sfx_guardrails": "Optional music & SFX guardrails (Optional)",
  "narrative_markdown": "Optional narrative markdown summary (Optional)"
}`,
    rights_disclosure_policy: `rights_disclosure_policy JSON schema:
{
  "asset_provenance_requirements": "Asset provenance/license rules (REQUIRED)",
  "disclosure_obligations": "Disclosure obligations for AI elements (REQUIRED)",
  "archival_policy": "Optional archival policy (Optional)",
  "reuse_policy": "Optional content reuse rules (Optional)",
  "narrative_markdown": "Optional narrative markdown summary (Optional)"
}`
  };

  return `You are a YouTube content strategist. Parse the uploaded text/markdown or brief and map it into the target Knowledge Base draft of type "${kbType}" for a YouTube ${scope}.

Target JSON Schema to output (you MUST use the exact JSON keys described below):
${typeDescriptions[kbType] || kbType}

Context provided by the user (which you must map/extract into the JSON fields):
${JSON.stringify(brief, null, 2)}

Target locale: ${locale}

Instructions:
1. Extract relevant information from the context and map it to the corresponding keys.
2. If any REQUIRED key's information is missing from the context, synthesize a reasonable default context-appropriate value. DO NOT leave REQUIRED keys empty or omit them.
3. Output ONLY a valid JSON object. No markdown block enclosing, no extra explanation text.
4. Keep all string values in ${locale} language.
5. Strings must be under 2000 characters. Arrays must contain 3-8 items.`;
}

function buildRefinePrompt({ kbType, currentContent, instruction, locale = 'id-ID' }) {
  return `You are a YouTube content strategist. Refine the following Knowledge Base draft of type "${kbType}".

Current content:
${JSON.stringify(currentContent, null, 2)}

Refinement instruction from the user:
${instruction}

Output the refined content as a single valid JSON object using the same field structure. Do not add or remove required fields. Do not include any explanation — only the JSON object.
Target locale: ${locale}.`;
}

// ── AI Draft Generation ────────────────────────────────────────────────────────

/**
 * Generate a KB draft using AI.
 * Returns structured content object validated against the KB type schema.
 * Status is always 'draft' — never auto-activated.
 */
export async function generateKnowledgeBaseDraft({ kbType, scope, brief, locale = 'id-ID' }) {
  if (!KB_TYPES.includes(kbType)) {
    throw new Error(`Unknown KB type: "${kbType}"`);
  }
  assertKbTypeScope(kbType, scope);

  const prompt = buildDraftPrompt({ kbType, scope, brief, locale });
  const rawResponse = await callGeminiAPI(prompt);
  const content = parseGeminiJSON(rawResponse);

  // Validate against schema — throw if invalid (caller should surface error to user)
  validateKnowledgeBase(kbType, content);

  return {
    kbType,
    scope,
    locale,
    content,
    ai_generated: true,
    status: 'draft',  // never auto-activated
  };
}

/**
 * Refine an existing KB revision draft using AI.
 * Returns updated content, still status 'draft'.
 */
export async function refineKnowledgeBaseDraft({ kbType, currentContent, instruction, locale = 'id-ID' }) {
  if (!KB_TYPES.includes(kbType)) {
    throw new Error(`Unknown KB type: "${kbType}"`);
  }
  if (!instruction || !instruction.trim()) {
    throw new Error('Refinement instruction is required');
  }

  const prompt = buildRefinePrompt({ kbType, currentContent, instruction, locale });
  const rawResponse = await callGeminiAPI(prompt);
  const content = parseGeminiJSON(rawResponse);

  // Validate refined content against schema
  validateKnowledgeBase(kbType, content);

  return {
    kbType,
    locale,
    content,
    ai_generated: true,
    status: 'draft',
  };
}
