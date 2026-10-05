import fs from 'fs';
import path from 'path';
import { getDomainKBs, CARTOON_SHARED_KBS, getUniverseProfileKBName } from './kb-routing.js';

import { getUniverseManifest } from './universe-manifests.js';

const KB_DIR = path.join(process.cwd(), 'kb');

// Cache KB contents in memory for fast performance
const kbCache = {};

export function readKbFile(filename, { silent = false } = {}) {
  if (kbCache[filename]) {
    return kbCache[filename];
  }
  const filePath = path.join(KB_DIR, filename);
  if (!fs.existsSync(filePath)) {
    if (!silent) {
      console.warn(`[KB Loader] Warning: KB file not found at ${filePath}`);
    }
    return '';
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  kbCache[filename] = content;
  return content;
}

export function synthesizeUniverseProfileKB(manifest) {
  if (!manifest) return '';
  const lines = [
    `# ${String(manifest.universe_profile || 'UNIVERSE').toUpperCase().replace(/_/g, ' ')} UNIVERSE PROFILE`,
    '',
    `## 1. World Identity`,
    `- **Slug:** ${manifest.universe_profile}`,
    `- **Type:** ${manifest.universe_type || 'stylized_cartoon'}`,
    `- **Human Presence:** ${manifest.human_presence || 'stylized_animated'}`,
    `- **Style Reference:** ${manifest.style_reference_path || 'None'}`,
    '',
    `## 2. Characters`
  ];
  if (manifest.characters) {
    for (const [key, char] of Object.entries(manifest.characters)) {
      lines.push(`- **${char.display_name || key}:**`);
      lines.push(`  - **Role:** ${char.role || 'character'}`);
      lines.push(`  - **Canonical Description:** ${char.canonical_description || '-'}`);
      if (char.forbidden_changes?.length) {
        lines.push(`  - **Guardrails:** ${char.forbidden_changes.join(', ')}`);
      }
    }
  }
  if (manifest.locations?.length) {
    lines.push('', `## 3. Locations`);
    for (const loc of manifest.locations) {
      lines.push(`- **${loc.name || loc.location_key}:** ${loc.visual_description || ''}`);
    }
  }
  return lines.join('\n');
}

/**
 * Load World-Aware KB modules based on content world context.
 * Returns pet, cartoon engine, visual continuity, and universe profile KBs as needed.
 * @param {Object|null} worldContext - { contentWorld, knowledgeDomain, universeProfile }
 */
export function getWorldAwareKB(worldContext) {
  if (!worldContext) return '';
  const parts = [];

  // Domain-specific KB
  const domainKBs = getDomainKBs(worldContext.knowledgeDomain);
  for (const kbName of domainKBs) {
    try {
      const kbContent = readKbFile(`${kbName}.md`);
      if (kbContent) parts.push(`=== ${kbName.replace(/_/g, ' ')} ===\n${kbContent}`);
    } catch (e) {
      console.warn(`[KB Loader] Error loading domain KB ${kbName}:`, e.message);
    }
  }

  // Cartoon universe loads story engine + visual continuity
  if (worldContext.contentWorld === 'cartoon_universe') {
    for (const kbName of CARTOON_SHARED_KBS) {
      try {
        const content = readKbFile(`${kbName}.md`);
        if (content) parts.push(`=== ${kbName.replace(/_/g, ' ')} ===\n${content}`);
      } catch (e) {
        console.warn(`[KB Loader] Error loading cartoon KB ${kbName}:`, e.message);
      }
    }

    // Universe profile
    if (worldContext.universeProfile) {
      try {
        const profileKbName = getUniverseProfileKBName(worldContext.universeProfile);
        const profileFile = `${profileKbName}.md`;
        let profileKb = readKbFile(profileFile, { silent: true });
        if (!profileKb) {
          const manifest = getUniverseManifest(worldContext.universeProfile);
          if (manifest) {
            profileKb = synthesizeUniverseProfileKB(manifest);
          }
        }
        if (profileKb) parts.push(`=== UNIVERSE PROFILE: ${worldContext.universeProfile.toUpperCase()} ===\n${profileKb}`);
      } catch (e) {
        console.warn(`[KB Loader] Error loading universe profile KB:`, e.message);
      }
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
