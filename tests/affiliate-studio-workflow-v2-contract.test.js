import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

test('Workflow V2 Contract: Existing core schemas exist and contain required base fields', () => {
  const dbPgPath = path.resolve(process.cwd(), 'lib/db-pg.js');
  assert.ok(fs.existsSync(dbPgPath), 'lib/db-pg.js must exist');

  const content = fs.readFileSync(dbPgPath, 'utf8');

  // Verify critical tables are defined in migration
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS affiliate_programs'), 'affiliate_programs must be defined');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS affiliate_program_planners'), 'affiliate_program_planners must be defined');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS affiliate_content_runs'), 'affiliate_content_runs must be defined');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS affiliate_content_schedules'), 'affiliate_content_schedules must be defined');

  // Verify affiliate_content_schedules schema columns
  assert.ok(content.includes('plan_type TEXT NOT NULL CHECK'), 'plan_type must have CHECK constraint');
  assert.ok(content.includes('cep_code TEXT'), 'cep_code column must exist');
  assert.ok(content.includes('promotion_context TEXT'), 'promotion_context column must exist');
  assert.ok(content.includes('target_platforms JSONB'), 'target_platforms must be JSONB');
});

test('Workflow V2 Contract: Affiliate Studio component hierarchy exists', () => {
  const componentPaths = [
    'app/affiliate-studio/components/AffiliateStudioWorkspace.js',
    'app/affiliate-studio/components/AffiliateContentCalendar.js',
    'app/affiliate-studio/components/CampaignProgramPlanners.js',
    'app/affiliate-studio/components/BrandProductionRuns.js'
  ];

  for (const comp of componentPaths) {
    const fullPath = path.resolve(process.cwd(), comp);
    assert.ok(fs.existsSync(fullPath), `Component ${comp} must exist`);
  }
});

test('Workflow V2 Contract: SSoT Mockup file exists and satisfies stage definitions', () => {
  const mockupPath = path.resolve(process.cwd(), 'public/mockup_affiliate_studio_workflow_v2.html');
  assert.ok(fs.existsSync(mockupPath), 'Mockup HTML must exist');

  const content = fs.readFileSync(mockupPath, 'utf8');

  // Assert Dual-View presence
  assert.ok(content.includes('btnViewCalendar'), 'Mockup must contain Calendar view toggle');
  assert.ok(content.includes('btnViewList'), 'Mockup must contain List view toggle');

  // Assert 6 CEP coverage (and no TOFU/MOFU/BOFU in stage 2 / KPIs)
  assert.ok(content.includes('Siklus 6 CEP Coverage'), 'Mockup must contain 6 CEP coverage KPI');
  assert.ok(!content.includes('TOFU:'), 'Mockup must not contain obsolete TOFU metrics');
  assert.ok(!content.includes('MOFU:'), 'Mockup must not contain obsolete MOFU metrics');
  assert.ok(!content.includes('BOFU:'), 'Mockup must not contain obsolete BOFU metrics');

  // Assert inline toolbar dispatch button
  assert.ok(content.includes('dispatchCountBadge'), 'Mockup must contain inline dispatch count badge');
});
