#!/usr/bin/env node

/**
 * Visual Identity Primary Style Audit & Safe Migration Script
 * 
 * Usage:
 *   node scripts/migrate-visual-identity-primary-styles.mjs [--dry-run]
 *   node scripts/migrate-visual-identity-primary-styles.mjs --apply --confirm-visual-style-migration
 */

import fs from 'fs';
import path from 'path';
import { pgQuery, closePgPool } from '../lib/db-pg.js';
import {
  DEFAULT_VISUAL_STYLE,
  VISUAL_STYLE_KEYS,
  VISUAL_LANGUAGE_CATALOG,
  isValidVisualStyle
} from '../lib/visual-language-catalog.js';
import {
  validateAndNormalizeVisualIdentity,
  LEGACY_STYLE_MAP,
  mapLegacyVisualStyle
} from '../lib/visual-identity-contract.js';

const ARGS = process.argv.slice(2);
const IS_APPLY = ARGS.includes('--apply');
const HAS_CONFIRM = ARGS.includes('--confirm-visual-style-migration');
const IS_DRY_RUN = !IS_APPLY || ARGS.includes('--dry-run');

export function classifyPresetForMigration(row) {
  const config = row.config_json || {};
  const vl = config.visual_language || {};
  const currentPrimary = vl.primary_style || config.style?.preset_key || null;
  const legacyStylePreset = config.style?.preset_key;
  const label = (row.label || '').toLowerCase();
  const presetKey = (row.preset_key || '').toLowerCase();
  const customDesc = (config.style?.custom_description || '').toLowerCase();
  const subjectKind = config.subject?.kind || 'human';
  const demographicKey = config.subject?.demographic_key || '';
  const envKey = config.environment?.preset_key || '';

  // Evaluate proposedPrimary and reason
  let candidateResult = null;

  // Case 1: Legitimate Editorial
  if (
    currentPrimary === 'editorial_graphic_novel' &&
    (presetKey.includes('way_siyasi') || label.includes('editorial') || label.includes('politik') || label.includes('siyasi') || customDesc.includes('editorial ink'))
  ) {
    candidateResult = {
      category: 'already-correct',
      currentPrimary,
      proposedPrimary: 'editorial_graphic_novel',
      reasonCode: 'EXPLICIT_EDITORIAL_CHOICE'
    };
  } else if (
    // Case 2: 3D / Clay Mascot Animal
    subjectKind === 'animal' ||
    subjectKind === 'mascot_object' ||
    label.includes('clay') ||
    label.includes('mascot') ||
    customDesc.includes('clay')
  ) {
    candidateResult = {
      category: 'safe-auto-fix',
      currentPrimary,
      proposedPrimary: 'cozy_claymation',
      reasonCode: 'MASCOT_OR_CLAY_CHARACTER'
    };
  } else if (
    // Case 3: 3D Stylized Human Character
    subjectKind === 'blank_face_3d' ||
    demographicKey.startsWith('stylized_3d_') ||
    label.includes('3d')
  ) {
    candidateResult = {
      category: 'safe-auto-fix',
      currentPrimary,
      proposedPrimary: 'stylized_3d_character',
      reasonCode: 'STYLIZED_3D_CHARACTER'
    };
  } else if (
    // Case 4: Culinary Kitchen
    envKey === 'nordic_kitchen' ||
    envKey === 'cozy_bakery' ||
    label.includes('kitchen') ||
    label.includes('dapur') ||
    label.includes('masak') ||
    label.includes('culinary')
  ) {
    candidateResult = {
      category: 'safe-auto-fix',
      currentPrimary,
      proposedPrimary: 'culinary_cinematic',
      reasonCode: 'CULINARY_KITCHEN_CONTEXT'
    };
  } else if (
    // Case 5: Commercial Product / Workspace / Watch
    envKey === 'general_workspace' ||
    label.includes('commercial') ||
    label.includes('watch') ||
    label.includes('worker') ||
    label.includes('tool') ||
    label.includes('product') ||
    label.includes('craftsman')
  ) {
    candidateResult = {
      category: 'safe-auto-fix',
      currentPrimary,
      proposedPrimary: 'commercial_product_cinematic',
      reasonCode: 'COMMERCIAL_PRODUCT_WORKSPACE'
    };
  } else if (
    // Case 6: Legacy Style mapped deterministically
    legacyStylePreset && LEGACY_STYLE_MAP[legacyStylePreset]
  ) {
    const mapped = LEGACY_STYLE_MAP[legacyStylePreset];
    candidateResult = {
      category: mapped === currentPrimary ? 'already-correct' : 'safe-auto-fix',
      currentPrimary,
      proposedPrimary: mapped,
      reasonCode: 'MAPPED_FROM_LEGACY_STYLE_KEY'
    };
  } else if (
    // Case 7: Valid style already set and distinct from editorial fallback
    currentPrimary && isValidVisualStyle(currentPrimary) && currentPrimary !== 'editorial_graphic_novel'
  ) {
    candidateResult = {
      category: 'already-correct',
      currentPrimary,
      proposedPrimary: currentPrimary,
      reasonCode: 'VALID_SEMANTIC_STYLE'
    };
  } else if (currentPrimary === 'editorial_graphic_novel' || !currentPrimary) {
    // Case 8: Default fallback to cinematic_realistic if candidate has no strong editorial signals
    candidateResult = {
      category: 'safe-auto-fix',
      currentPrimary,
      proposedPrimary: DEFAULT_VISUAL_STYLE,
      reasonCode: 'NEUTRAL_CINEMATIC_DEFAULT'
    };
  } else {
    candidateResult = {
      category: 'review-required',
      currentPrimary,
      proposedPrimary: currentPrimary || DEFAULT_VISUAL_STYLE,
      reasonCode: 'AMBIGUOUS_CONFIG_NEEDS_MANUAL_REVIEW'
    };
  }

  // Idempotency check: If current is already equal to proposed and is a valid style, mark already-correct
  if (
    candidateResult.category === 'safe-auto-fix' &&
    candidateResult.currentPrimary === candidateResult.proposedPrimary &&
    isValidVisualStyle(candidateResult.currentPrimary)
  ) {
    candidateResult.category = 'already-correct';
    candidateResult.reasonCode = 'ALREADY_CONSISTENT';
  }

  return candidateResult;
}

async function runAuditAndMigration() {
  const targetSchema = process.env.PG_SEARCH_PATH || 'public';
  console.log(`\n========================================================================`);
  console.log(`🔍 VISUAL IDENTITY STYLE AUDIT & MIGRATION TOOL`);
  console.log(`========================================================================`);
  console.log(`Mode        : ${IS_APPLY ? '🚀 APPLY (MUTATION)' : '🛡️ DRY-RUN (AUDIT ONLY)'}`);
  console.log(`Schema/Path : ${targetSchema}`);
  console.log(`Timestamp   : ${new Date().toISOString()}`);

  if (IS_APPLY && !HAS_CONFIRM) {
    console.error(`\n❌ ERROR: --apply requires --confirm-visual-style-migration flag.`);
    process.exit(1);
  }

  // Query tenant visual identity presets
  const queryResult = await pgQuery(`
    SELECT id, tenant_id, preset_key, label, description, status, version, config_json, created_at, updated_at
    FROM visual_identity_presets
    ORDER BY id ASC
  `);

  const rows = queryResult.rows;
  console.log(`Total tenant presets in DB: ${rows.length}\n`);

  const categorized = {
    'safe-auto-fix': [],
    'already-correct': [],
    'review-required': [],
    'invalid-unmapped': []
  };

  const auditManifest = [];

  for (const row of rows) {
    const classification = classifyPresetForMigration(row);
    categorized[classification.category].push({
      row,
      ...classification
    });

    auditManifest.push({
      id: row.id,
      tenant_id: row.tenant_id,
      preset_key: row.preset_key,
      label: row.label,
      current_primary: classification.currentPrimary,
      proposed_primary: classification.proposedPrimary,
      category: classification.category,
      reason_code: classification.reasonCode
    });
  }

  console.log(`📊 Summary by Classification:`);
  console.log(`  • already-correct : ${categorized['already-correct'].length}`);
  console.log(`  • safe-auto-fix   : ${categorized['safe-auto-fix'].length}`);
  console.log(`  • review-required : ${categorized['review-required'].length}`);
  console.log(`  • invalid-unmapped: ${categorized['invalid-unmapped'].length}`);

  if (categorized['safe-auto-fix'].length > 0) {
    console.log(`\n📋 Safe Candidates for Migration:`);
    for (const item of categorized['safe-auto-fix']) {
      console.log(`  - [${item.row.id}] "${item.row.label}" (${item.row.preset_key})`);
      console.log(`    Current : ${item.currentPrimary} ➔ Proposed: ${item.proposedPrimary} (${item.reasonCode})`);
    }
  }

  if (categorized['review-required'].length > 0) {
    console.log(`\n⚠️ Presets Requiring Review:`);
    for (const item of categorized['review-required']) {
      console.log(`  - [${item.row.id}] "${item.row.label}": ${item.reasonCode}`);
    }
  }

  // If APPLY mode: execute in transaction
  if (IS_APPLY && categorized['safe-auto-fix'].length > 0) {
    console.log(`\n🚀 Applying migration to ${categorized['safe-auto-fix'].length} records inside transaction...`);

    const { getPgPool } = await import('../lib/db-pg.js');
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let updatedCount = 0;
      for (const item of categorized['safe-auto-fix']) {
        const currentConfig = item.row.config_json || {};
        const updatedConfig = {
          ...currentConfig,
          schema_version: '2',
          visual_language: {
            ...(currentConfig.visual_language || {}),
            primary_style: item.proposedPrimary,
            supporting_styles: currentConfig.visual_language?.supporting_styles || [],
            disabled_styles: currentConfig.visual_language?.disabled_styles || []
          },
          style: {
            ...(currentConfig.style || {}),
            preset_key: item.proposedPrimary
          }
        };

        const validated = validateAndNormalizeVisualIdentity(updatedConfig);

        const res = await client.query(`
          UPDATE visual_identity_presets
          SET config_json = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND version = $3
          RETURNING id, version
        `, [JSON.stringify(validated), item.row.id, item.row.version]);

        if (res.rowCount === 1) {
          updatedCount++;
        } else {
          throw new Error(`Optimistic concurrency lock failed for preset ${item.row.id} (version mismatch)`);
        }
      }

      await client.query('COMMIT');
      console.log(`✅ Migration successfully applied: ${updatedCount} rows updated.`);

      // Write manifest artifact
      const manifestPath = path.join(process.cwd(), 'data', `migration_visual_styles_${targetSchema}_${Date.now()}.json`);
      try {
        fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        fs.writeFileSync(manifestPath, JSON.stringify(auditManifest, null, 2), 'utf8');
        console.log(`📝 Migration manifest saved to: ${manifestPath}`);
      } catch (e) {
        console.warn(`(Manifest save warning: ${e.message})`);
      }
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Migration failed and rolled back:`, err);
      process.exit(1);
    } finally {
      client.release();
    }
  } else if (IS_APPLY) {
    console.log(`\n✨ No safe candidates to migrate. Zero mutations performed.`);
  } else {
    console.log(`\n🛡️ Dry-run completed. Zero mutations performed in database.`);
  }
}

async function main() {
  try {
    await runAuditAndMigration();
  } catch (err) {
    console.error('❌ Audit execution failed:', err);
    process.exit(1);
  } finally {
    await closePgPool();
    process.exit(0);
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate-visual-identity-primary-styles.mjs')) {
  main();
}
