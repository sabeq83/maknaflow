import { jsonrepair } from 'jsonrepair';

/**
 * Robust JSON parser for Gemini responses.
 * Handles: markdown code blocks, BOM, control chars, unescaped quotes, trailing commas, etc.
 * 
 * Strategies:
 * 1. Direct parse
 * 2. Remove harmful control chars (keep structural whitespace)
 * 3. Replace ALL control chars with spaces
 * 4. jsonrepair library (fixes unescaped quotes, trailing commas, etc.)
 */
export function parseGeminiJSON(responseText, voiceProvider = 'minimax') {
  // Strip BOM and trim
  let textToParse = responseText.replace(/^\uFEFF/, '').trim();

  // Extract from markdown code block if present
  const jsonMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) textToParse = jsonMatch[1].trim();

  // Find JSON boundaries
  const firstBrace = textToParse.indexOf('{');
  const lastBrace = textToParse.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    textToParse = textToParse.substring(firstBrace, lastBrace + 1);
  }

  const strategies = [
    // Strategy 1: Direct parse
    () => JSON.parse(textToParse),

    // Strategy 2: jsonrepair (best for missing commas, trailing commas)
    () => JSON.parse(jsonrepair(textToParse)),

    // Strategy 3: Remove harmful control chars but KEEP newlines (helps jsonrepair guess missing commas)
    () => {
      const cleaned = textToParse.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '');
      return JSON.parse(jsonrepair(cleaned));
    },

    // Strategy 4: Escape unescaped quotes inside values (heuristic)
    () => {
      // Replaces quotes that have word chars/spaces on both sides
      let fixedQuotes = textToParse.replace(/([a-zA-Z0-9,.:;!?])"([a-zA-Z0-9\s])/g, '$1\\"$2');
      return JSON.parse(jsonrepair(fixedQuotes));
    },

    // Strategy 5: Replace ALL control chars (including newlines) with space
    // Warning: This destroys jsonrepair's ability to fix missing commas, so use as last resort
    () => {
      const aggressive = textToParse.replace(/[\x00-\x1f]/g, ' ');
      return JSON.parse(jsonrepair(aggressive));
    },
    
    // Strategy 6: Aggressive Regex Fallback Extraction (If all JSON parsing fails)
    // We return a default structure and try to extract whatever we can
    () => {
      console.warn("All JSON parse strategies failed, falling back to Regex extraction.");
      const fallback = { storyboard: [], voiceover: [], t2v_prompts: [], tiktok_caption: "", ig_caption: "" };
      
      // Try to extract captions
      const tiktokMatch = textToParse.match(/"tiktok_caption"\s*:\s*"([^"]+)"/i);
      if (tiktokMatch) fallback.tiktok_caption = tiktokMatch[1];
      
      const igMatch = textToParse.match(/"ig_caption"\s*:\s*"([^"]+)"/i);
      if (igMatch) fallback.ig_caption = igMatch[1];

      // If we can't extract arrays reliably, we just return the empty fallback
      // so the app doesn't completely crash and the user can at least retry.
      return fallback;
    }
  ];

  let lastError = null;
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (result && typeof result === 'object') {
        // Normalize prompts keys to prevent missing prompts due to slight key variations from Gemini
        // We prioritize video generation prompts (t2v_prompts, prompts, i2v_prompts) over static image prompts (t2i_prompts)
        if (!result.t2v_prompts || result.t2v_prompts.length === 0) {
          if (Array.isArray(result.prompts) && result.prompts.length > 0) {
            result.t2v_prompts = result.prompts;
          } else if (Array.isArray(result.i2v_prompts) && result.i2v_prompts.length > 0) {
            result.t2v_prompts = result.i2v_prompts;
          } else if (Array.isArray(result.t2i_prompts) && result.t2i_prompts.length > 0) {
            result.t2v_prompts = result.t2i_prompts;
          }
        }

        // Clean up structured JSON string prompts and convert them to plain text
        if (Array.isArray(result.t2v_prompts)) {
          result.t2v_prompts = result.t2v_prompts.map(p => {
            if (p && typeof p === 'object' && typeof p.prompt === 'string') {
              p.prompt = convertStructuredPromptToPlainText(p.prompt);
              p.prompt = stripAudioScriptFromPrompt(p.prompt);
            }
            return p;
          });
        }
        if (Array.isArray(result.i2v_prompts)) {
          result.i2v_prompts = result.i2v_prompts.map(p => {
            if (p && typeof p === 'object') {
              if (typeof p.prompt === 'object') {
                p.prompt = JSON.stringify(p.prompt);
              }
              if (typeof p.prompt === 'string' && voiceProvider !== 'gemini') {
                p.prompt = convertStructuredPromptToPlainText(p.prompt);
                p.prompt = stripAudioScriptFromPrompt(p.prompt);
              }
            }
            return p;
          });
        }
        if (Array.isArray(result.t2i_prompts)) {
          result.t2i_prompts = result.t2i_prompts.map(p => {
            if (p && typeof p === 'object' && typeof p.prompt === 'string') {
              p.prompt = convertStructuredPromptToPlainText(p.prompt);
              p.prompt = stripAudioScriptFromPrompt(p.prompt);
            }
            return p;
          });
        }

        return result;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`Gagal parse respons Gemini setelah ${strategies.length} strategi: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Converts a structured escaped JSON prompt into a clean 5-layer plain text paragraph.
 */
export function convertStructuredPromptToPlainText(promptVal) {
  if (typeof promptVal !== 'string') return promptVal;
  const trimmed = promptVal.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('{\\"')) return promptVal;

  try {
    // Handle doubly-escaped or escaped quotes if present
    let normalized = trimmed;
    if (trimmed.startsWith('{\\"')) {
      normalized = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    const obj = JSON.parse(normalized);
    if (!obj || typeof obj !== 'object') return promptVal;

    const meta = obj.project_metadata || {};
    const visual = obj.visual_prompt_stack || {};
    const sub = visual["subject_&_acting"] || {};
    const light = visual["lighting_&_atmosphere"] || {};
    const pacing = obj.micro_pacing_timeline || [];

    const parts = [];

    // Aspect ratio & static parameters
    const ar = meta.aspect_ratio || '--ar 9:16';
    parts.push(`(VERTICAL 9:16) ${ar} --no landscape`);

    // Layer 1: Subject & Optics
    const subj = sub.core_subject || '';
    const act = sub.micro_acting_key_phrase || '';
    const style = meta.visual_reference_style || '';
    if (subj || act || style) {
      const info = [];
      if (subj) info.push(`Subject: ${subj}`);
      if (act) info.push(`Action: ${act}`);
      if (style) info.push(`Style: ${style}`);
      parts.push(`[LAYER 1: SUBJECT & VISUAL TRUTH] (${info.join(', ')})`);
    }

    // Layer 2: Micro-pacing
    if (pacing.length > 0) {
      const pacingParts = pacing.map(p => {
        const seg = p.time_segment || '';
        const beat = p.visual_acting_beat || '';
        const audio = p.audio_embed || '';
        return `${seg}: (Visual Action: ${beat}), (Audio: "${audio}")`;
      });
      parts.push(`[LAYER 2: MICRO-PACING & ACTION] ${pacingParts.join(' ')}`);
    }

    // Layer 3: SFX & Mixing
    const sfx = obj.audio_design_stack || {};
    const cue = obj.sfx_music || (sfx.voice_engine_config ? 'SFX & Voice Mix Standard' : '');
    if (cue) {
      parts.push(`[LAYER 3: SFX] SFX/MUSIC: ${cue}`);
    }

    return parts.join(' ');
  } catch (err) {
    console.error('[json-parser] Failed to convert structured prompt:', err.message);
    return promptVal;
  }
}

/**
 * Strips spoken word audio scripts and voice details from visual prompts to prevent video generator confusion,
 * keeping only visual/SFX instructions.
 */
export function stripAudioScriptFromPrompt(promptStr) {
  if (typeof promptStr !== 'string') return promptStr;
  
  // 1. Remove [LAYER 3: FULL SCRIPT REFERENCE] and extract SFX if present
  if (promptStr.includes('FULL SCRIPT REFERENCE')) {
    const sfxMatch = promptStr.match(/SFX(?:\/MUSIC)?:\s*([\s\S]+)$/i);
    let sfxText = '';
    if (sfxMatch) {
      sfxText = sfxMatch[1].trim();
    }
    
    let cleaned = promptStr.replace(/\[LAYER \d+: FULL SCRIPT REFERENCE\][\s\S]*$/i, '');
    if (sfxText) {
      cleaned = cleaned.trim() + ` [LAYER 3: SFX] SFX/MUSIC: ${sfxText}`;
    }
    return cleaned.trim();
  }
  
  // 2. Individual fallback replacements
  let cleaned = promptStr;
  cleaned = cleaned.replace(/AUDIO SCRIPT:\s*"[^"]*"\s*/gi, '');
  cleaned = cleaned.replace(/VOICE:\s*\([^)]*\)\s*/gi, '');
  
  return cleaned.trim();
}
