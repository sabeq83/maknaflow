import fs from 'fs';
import path from 'path';

const KB_DIR = path.join(process.cwd(), 'kb');

// Cache KB contents in memory for fast performance
const kbCache = {};

export function readKbFile(filename) {
  if (kbCache[filename]) {
    return kbCache[filename];
  }
  const filePath = path.join(KB_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`[KB Loader] Warning: KB file not found at ${filePath}`);
    return '';
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  kbCache[filename] = content;
  return content;
}

/**
 * Load World-Aware KB modules based on content world context.
 * Returns pet, cartoon engine, visual continuity, and universe profile KBs as needed.
 * @param {Object|null} worldContext - { contentWorld, knowledgeDomain, universeProfile }
 */
function getWorldAwareKB(worldContext) {
  if (!worldContext) return '';
  const parts = [];

  // Domain-specific KB (pet_supplies loads pet content KB)
  if (worldContext.knowledgeDomain === 'pet_supplies') {
    const petKb = readKbFile('PET_CONTENT_KB.md');
    if (petKb) parts.push(`=== PET CONTENT KNOWLEDGE BASE ===\n${petKb}`);
  }

  // Cartoon universe loads story engine + visual continuity
  if (worldContext.contentWorld === 'cartoon_universe') {
    const storyEngine = readKbFile('CARTOON_UNIVERSE_STORY_ENGINE.md');
    if (storyEngine) parts.push(`=== CARTOON UNIVERSE STORY ENGINE ===\n${storyEngine}`);

    const visualContinuity = readKbFile('CARTOON_VISUAL_CONTINUITY_KB.md');
    if (visualContinuity) parts.push(`=== CARTOON VISUAL CONTINUITY ===\n${visualContinuity}`);

    // Universe profile (e.g., PawVille)
    if (worldContext.universeProfile) {
      const profileFile = `universes/${worldContext.universeProfile.toUpperCase()}_UNIVERSE_PROFILE.md`;
      const profileKb = readKbFile(profileFile);
      if (profileKb) parts.push(`=== UNIVERSE PROFILE: ${worldContext.universeProfile.toUpperCase()} ===\n${profileKb}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Load Strategic Skeleton KBs (Frameworks & Decision Tree)
 * @param {Object|null} worldContext - Optional. If provided, loads additional world-aware KBs.
 */
export function getStrategicSkeletonKB(worldContext = null) {
  const frameworks = readKbFile('STRATEGIC_FRAMEWORKS_v47.9.md');
  const decisionTree = readKbFile('STRATEGIC_DECISION_TREE.md');
  let result = `=== STRATEGIC FRAMEWORKS ===\n${frameworks}\n\n=== STRATEGIC DECISION TREE ===\n${decisionTree}`;

  // Append world-aware KB modules if applicable
  if (worldContext) {
    const extra = getWorldAwareKB(worldContext);
    if (extra) result += `\n\n${extra}`;
  }
  return result;
}

/**
 * Load Creative Generator KBs (Narrative, Visual, Brand Voice, Copywriting, System Prompt)
 * @param {Object|null} worldContext - Optional. Cartoon universe skips realist/photorealistic KBs.
 */
export function getCreativeGeneratorKB(worldContext = null) {
  const isCartoon = worldContext?.contentWorld === 'cartoon_universe';

  const narrative = readKbFile('NARRATIVE_STRUCTURE_v47.9.md');
  // DO NOT load realist/photorealistic KBs for cartoon universe — they contain
  // negative instructions that conflict with 3D/CGI cartoon rendering
  const viralNarrative = isCartoon ? '' : readKbFile('REALIST_VIRAL_NARRATIVE_v47.9.md');
  const visualStyle = isCartoon ? '' : readKbFile('VISUAL_STYLE_GUIDE_v47.9.md');
  const brandVoice = readKbFile('01_BRAND_VOICE_GUIDE_en.md');
  const platformCopy = readKbFile('02_PLATFORM_COPYWRITING_GUIDE_en.md');
  const compliance = readKbFile('COMPLIANCE_GUIDE.md');
  const promptSystem = readKbFile('PROMPT_SYSTEM_v47.9.md');

  let result = `=== NARRATIVE STRUCTURE ===\n${narrative}`;
  if (viralNarrative) result += `\n\n=== REALIST VIRAL NARRATIVE ===\n${viralNarrative}`;
  if (visualStyle) result += `\n\n=== VISUAL STYLE GUIDE ===\n${visualStyle}`;
  result += `\n\n=== BRAND VOICE GUIDE ===\n${brandVoice}`;
  result += `\n\n=== PLATFORM COPYWRITING GUIDE ===\n${platformCopy}`;
  result += `\n\n=== COMPLIANCE GUIDE ===\n${compliance}`;
  result += `\n\n=== PROMPT SYSTEM DIRECTIVES ===\n${promptSystem}`;

  // Append world-aware KB modules if applicable
  if (worldContext) {
    const extra = getWorldAwareKB(worldContext);
    if (extra) result += `\n\n${extra}`;
  }
  return result;
}

/**
 * Load Reviewer KBs (Compliance, CTA Rules, SEO Guide)
 */
export function getReviewerKB() {
  const compliance = readKbFile('COMPLIANCE_GUIDE.md');
  const ctaRules = readKbFile('CTA_RULES.md');
  const seoGuide = readKbFile('SEO_GUIDE.md');

  return `=== COMPLIANCE GUIDE ===\n${compliance}\n\n=== CTA RULES ===\n${ctaRules}\n\n=== SEO GUIDE ===\n${seoGuide}`;
}
