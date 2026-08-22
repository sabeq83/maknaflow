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
    channel_profile: `Channel Profile: positioning statement, primary language, editorial tone, target_audience_segments (array of strings), content_pillars (array of strings), optional cta_patterns, forbidden_claims, monetization_direction, narrative_markdown.`,
    series_content_guide: `Series Content Guide: series_name, episode_format, recurring_chapters (array of strings), optional playlist_pattern, content_boundary, narrative_markdown.`,
    longform_editorial_playbook: `Editorial Playbook: hook_strategy, retention_techniques, pacing_notes, optional open_loop_guidance, cta_architecture, chapter_structure_template, narrative_markdown.`,
    research_source_policy: `Research Source Policy: source_standards, claim_confidence_threshold, optional citation_format, factual_uncertainty_handling, prohibited_sources, narrative_markdown.`,
    visual_continuity_guide: `Visual Continuity Guide: visual_grammar (required), optional character_rules, location_rules, palette_guidance, framing_notes, lighting_notes, drift_prevention, narrative_markdown.`,
    prompt_production_playbook: `Prompt Production Playbook: prompt_grammar (required), optional continuity_tokens, negative_prompt_policy, t2v_style_guidance, i2v_style_guidance, narrative_markdown.`,
    voice_audio_guide: `Voice & Audio Guide: voice_persona, speech_pacing, optional pronunciation_notes, music_sfx_guardrails, narrative_markdown.`,
    rights_disclosure_policy: `Rights & Disclosure Policy: asset_provenance_requirements, disclosure_obligations, optional archival_policy, reuse_policy, narrative_markdown.`,
  };

  return `You are a YouTube content strategist. Generate a structured Knowledge Base draft of type "${kbType}" for a YouTube ${scope}.

KB Type Description:
${typeDescriptions[kbType] || kbType}

Context provided by the user:
${JSON.stringify(brief, null, 2)}

Target locale: ${locale}

Output a single valid JSON object matching the exact fields described above. Do not include any explanation or markdown — only the JSON object.
All text should be in the locale language (${locale}).
Keep each text field under 2000 characters. Arrays should have 3–8 items.`;
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
