const LEGACY_OUTRO_PATTERN = /^\s*(?:akhiran|penutup)\s*(?:(?:skrip|script|naskah)\s*)?(?:\/\s*)?(?:voice[ -]?over|vo)?\s*:\s*(.+?)\s*$/i;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function extractLegacyOutro(value) {
  const instruction = clean(value);
  const match = instruction.match(LEGACY_OUTRO_PATTERN);
  return match ? clean(match[1]) : '';
}

export function resolvePromptInstructions(input = {}) {
  const explicitDirective = clean(input.ai_directive);
  const explicitOutro = clean(input.mandatory_outro_line);
  const legacyInstruction = clean(input.custom_instruction);
  const legacyOutro = extractLegacyOutro(legacyInstruction);
  const legacyDirective = legacyOutro ? '' : legacyInstruction;

  return {
    aiDirective: [explicitDirective, legacyDirective].filter(Boolean).join('\n'),
    mandatoryOutroLine: explicitOutro || legacyOutro
  };
}

export function resolvePlannerInstructions(planner = {}) {
  if (planner.planner_focus === 'brand_editorial') {
    return resolvePromptInstructions({
      ai_directive: planner.ai_directive || planner.brand_context,
      mandatory_outro_line: planner.mandatory_outro_line,
      custom_instruction: planner.custom_instruction
    });
  }
  return resolvePromptInstructions(planner);
}
