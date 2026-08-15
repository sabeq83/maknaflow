import test from 'node:test';
import assert from 'node:assert/strict';
import { tenantContext } from '../lib/tenant-context.js';
import {
  parseAndValidateReportingFilters,
  getContentFlowReporting,
  REPORTING_DATE_DIMENSIONS,
  REPORTING_PIPELINE_STATUSES,
  REPORTING_RANGES
} from '../lib/contentflow-reporting.js';

test('parseAndValidateReportingFilters - export constants', () => {
  assert.equal(REPORTING_DATE_DIMENSIONS.has('production'), true);
  assert.equal(REPORTING_DATE_DIMENSIONS.has('publish'), true);
  assert.equal(REPORTING_PIPELINE_STATUSES.has('Completed'), true);
  assert.equal(REPORTING_RANGES.has('30d'), true);
});

test('parseAndValidateReportingFilters - rejects invalid date_dimension', () => {
  assert.throws(() => {
    parseAndValidateReportingFilters({ date_dimension: 'invalid_dim' });
  }, (err) => err.status === 400 && err.message.includes('date_dimension tidak valid'));
});

test('parseAndValidateReportingFilters - rejects invalid pipeline_status', () => {
  assert.throws(() => {
    parseAndValidateReportingFilters({ pipeline_status: 'invalid_status' });
  }, (err) => err.status === 400 && err.message.includes('pipeline_status tidak valid'));
});

test('parseAndValidateReportingFilters - rejects invalid range', () => {
  assert.throws(() => {
    parseAndValidateReportingFilters({ range: 'invalid_range' });
  }, (err) => err.status === 400 && err.message.includes('range tidak valid'));
});

test('parseAndValidateReportingFilters - validates custom range required fields', () => {
  assert.throws(() => {
    parseAndValidateReportingFilters({ range: 'custom', date_from: '2026-08-01' });
  }, (err) => err.status === 400 && err.message.includes('wajib diisi'));
});

test('parseAndValidateReportingFilters - validates custom range date format', () => {
  assert.throws(() => {
    parseAndValidateReportingFilters({ range: 'custom', date_from: '01-08-2026', date_to: '2026-08-10' });
  }, (err) => err.status === 400 && err.message.includes('Gunakan YYYY-MM-DD'));
});

test('parseAndValidateReportingFilters - validates date_from <= date_to', () => {
  assert.throws(() => {
    parseAndValidateReportingFilters({ range: 'custom', date_from: '2026-08-10', date_to: '2026-08-01' });
  }, (err) => err.status === 400 && err.message.includes('tidak boleh lebih besar'));
});

test('parseAndValidateReportingFilters - validates custom range max 366 days', () => {
  assert.throws(() => {
    parseAndValidateReportingFilters({ range: 'custom', date_from: '2025-01-01', date_to: '2026-08-01' });
  }, (err) => err.status === 400 && err.message.includes('tidak boleh melebihi 366 hari'));
});

test('parseAndValidateReportingFilters - parses valid 30d range', () => {
  const result = parseAndValidateReportingFilters({ range: '30d' });
  assert.equal(result.range, '30d');
  assert.equal(result.dateDimension, 'production');
  assert.equal(typeof result.dateFrom, 'string');
  assert.equal(typeof result.dateTo, 'string');
  assert.equal(result.dateFromIso.endsWith('+07:00'), true);
  assert.equal(result.dateToExclusiveIso.endsWith('+07:00'), true);
});

test('getContentFlowReporting - throws 403 when tenant is missing or __none__', async () => {
  await assert.rejects(async () => {
    await tenantContext.run('__none__', async () => {
      await getContentFlowReporting({ range: '30d' });
    });
  }, (err) => err.status === 403 && err.message.includes('Tenant operasional tidak tersedia'));
});

test('getContentFlowReporting - empty assigned brand array returns zero assets', async () => {
  await tenantContext.run('test_reporting_tenant', async () => {
    const report = await getContentFlowReporting({
      range: 'all',
      allowedAccounts: []
    });

    assert.equal(typeof report.summary.total_assets, 'number');
    assert.equal(report.summary.total_assets, 0);
    assert.equal(report.brands.length, 0);
    assert.equal(report.available_accounts.length, 0);
  });
});

test('getContentFlowReporting - returns numeric data types in summary, platforms, anomalies, and brands', async () => {
  await tenantContext.run('default_tenant', async () => {
    const filters = parseAndValidateReportingFilters({ range: 'all' });
    const report = await getContentFlowReporting(filters);

    assert.equal(typeof report.summary.total_assets, 'number');
    assert.equal(typeof report.summary.completed_assets, 'number');
    assert.equal(typeof report.summary.in_production_assets, 'number');
    assert.equal(typeof report.summary.published_any_assets, 'number');
    assert.equal(typeof report.summary.never_published_assets, 'number');
    assert.equal(typeof report.summary.ready_unpublished_assets, 'number');
    assert.equal(typeof report.summary.fully_distributed_assets, 'number');

    assert.equal(typeof report.platforms.tiktok, 'number');
    assert.equal(typeof report.platforms.facebook, 'number');
    assert.equal(typeof report.platforms.instagram, 'number');
    assert.equal(typeof report.platforms.youtube, 'number');

    assert.equal(typeof report.anomalies.total, 'number');

    if (report.brands.length > 0) {
      const b = report.brands[0];
      assert.equal(typeof b.total_assets, 'number');
      assert.equal(typeof b.published_any_assets, 'number');
      assert.equal(typeof b.never_published_assets, 'number');
      assert.equal(typeof b.coverage_percent, 'number');
    }
  });
});
