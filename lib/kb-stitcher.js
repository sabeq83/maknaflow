import fs from 'fs';
import path from 'path';

// Explicit ideal order of Knowledge Base files to merge
const KB_FILES_ORDER = [
  'PROMPT_SYSTEM_v47.9.md',
  'NARRATIVE_STRUCTURE_v47.9.md',
  'STRATEGIC_FRAMEWORKS_v47.9.md',
  'REALIST_VIRAL_NARRATIVE_v47.9.md',
  'VISUAL_STYLE_GUIDE_v47.9.md',
  'COMPLIANCE_GUIDE.md',
  '01_BRAND_VOICE_GUIDE_en.md',
  '02_PLATFORM_COPYWRITING_GUIDE_en.md',
  'CTA_RULES.md',
  'SEO_GUIDE.md',
  'STRATEGIC_DECISION_TREE.md',
  'Food Styling & Photography KB.md'
];

/**
 * Reads all KB files from the /kb/ folder and joins them with structured markdown boundaries.
 * @returns {string} Master Payload System Instruction for Gemini Context Caching
 */
export function getStitchedMasterKB() {
  const seedsFolder = path.join(process.cwd(), 'kb');
  let stitchedString = `## MAKNA ENGINE V7 MASTER KNOWLEDGE BASE ##\n`;
  stitchedString += `This is the complete system directive, mandates, and creative guidelines for MAKNA Engine. Adhere to all rules strictly.\n\n`;

  for (const fileName of KB_FILES_ORDER) {
    const filePath = path.join(seedsFolder, fileName);
    
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Insert structured boundaries between instruction domains
      stitchedString += `\n\n========================================================================\n`;
      stitchedString += `MODULE START: ${fileName.toUpperCase()}\n`;
      stitchedString += `========================================================================\n\n`;
      stitchedString += fileContent;
      stitchedString += `\n\n========================================================================\n`;
      stitchedString += `MODULE END: ${fileName.toUpperCase()}\n`;
      stitchedString += `========================================================================\n`;
    } else {
      console.warn(`[KB Stitcher] File ${fileName} not found in folder kb/! Skipping.`);
    }
  }

  return stitchedString;
}
