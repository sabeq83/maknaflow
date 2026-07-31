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
 * Load Strategic Skeleton KBs (Frameworks & Decision Tree)
 */
export function getStrategicSkeletonKB() {
  const frameworks = readKbFile('STRATEGIC_FRAMEWORKS_v47.9.md');
  const decisionTree = readKbFile('STRATEGIC_DECISION_TREE.md');
  return `=== STRATEGIC FRAMEWORKS ===\n${frameworks}\n\n=== STRATEGIC DECISION TREE ===\n${decisionTree}`;
}

/**
 * Load Creative Generator KBs (Narrative, Visual, Brand Voice, Copywriting, System Prompt)
 */
export function getCreativeGeneratorKB() {
  const narrative = readKbFile('NARRATIVE_STRUCTURE_v47.9.md');
  const viralNarrative = readKbFile('REALIST_VIRAL_NARRATIVE_v47.9.md');
  const visualStyle = readKbFile('VISUAL_STYLE_GUIDE_v47.9.md');
  const brandVoice = readKbFile('01_BRAND_VOICE_GUIDE_en.md');
  const platformCopy = readKbFile('02_PLATFORM_COPYWRITING_GUIDE_en.md');
  const compliance = readKbFile('COMPLIANCE_GUIDE.md');
  const promptSystem = readKbFile('PROMPT_SYSTEM_v47.9.md');

  return `=== NARRATIVE STRUCTURE ===\n${narrative}\n\n=== REALIST VIRAL NARRATIVE ===\n${viralNarrative}\n\n=== VISUAL STYLE GUIDE ===\n${visualStyle}\n\n=== BRAND VOICE GUIDE ===\n${brandVoice}\n\n=== PLATFORM COPYWRITING GUIDE ===\n${platformCopy}\n\n=== COMPLIANCE GUIDE ===\n${compliance}\n\n=== PROMPT SYSTEM DIRECTIVES ===\n${promptSystem}`;
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
