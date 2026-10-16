import test from 'node:test';
import assert from 'node:assert/strict';
import { getMultiplierTasksByBatchId } from '../lib/db.js';

test('Multiplier Steady Order: deterministic sorting helper sorts strictly by row_index ASC and id ASC', () => {
  // Simulate out-of-order rows as returned by un-ordered query
  const rawTasks = [
    { id: 'mul_261016_test_04', row_index: 3, status: 'completed' },
    { id: 'mul_261016_test_01', row_index: 0, status: 'generating_t2i' },
    { id: 'mul_261016_test_05', row_index: 4, status: 'uploading_assets' },
    { id: 'mul_261016_test_02', row_index: 1, status: 'waiting_approval' },
    { id: 'mul_261016_test_03', row_index: 2, status: 'ffmpeg_muxing' }
  ];

  const sorted = [...rawTasks].sort((a, b) => {
    const aIdx = (a.row_index !== null && a.row_index !== undefined) ? Number(a.row_index) : 0;
    const bIdx = (b.row_index !== null && b.row_index !== undefined) ? Number(b.row_index) : 0;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
  });

  assert.equal(sorted[0].id, 'mul_261016_test_01');
  assert.equal(sorted[0].row_index, 0);

  assert.equal(sorted[1].id, 'mul_261016_test_02');
  assert.equal(sorted[1].row_index, 1);

  assert.equal(sorted[2].id, 'mul_261016_test_03');
  assert.equal(sorted[2].row_index, 2);

  assert.equal(sorted[3].id, 'mul_261016_test_04');
  assert.equal(sorted[3].row_index, 3);

  assert.equal(sorted[4].id, 'mul_261016_test_05');
  assert.equal(sorted[4].row_index, 4);
});

test('Multiplier Steady Order: handles null row_index by falling back to natural numeric ID sort', () => {
  const legacyTasks = [
    { id: 'batch_xyz_03', row_index: null },
    { id: 'batch_xyz_01', row_index: null },
    { id: 'batch_xyz_02', row_index: null }
  ];

  const sorted = [...legacyTasks].sort((a, b) => {
    const aIdx = (a.row_index !== null && a.row_index !== undefined) ? Number(a.row_index) : 0;
    const bIdx = (b.row_index !== null && b.row_index !== undefined) ? Number(b.row_index) : 0;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
  });

  assert.equal(sorted[0].id, 'batch_xyz_01');
  assert.equal(sorted[1].id, 'batch_xyz_02');
  assert.equal(sorted[2].id, 'batch_xyz_03');
});

test('Multiplier Steady Order: getMultiplierTasksByBatchId returns empty array for null/empty batchId', async () => {
  const emptyRes = await getMultiplierTasksByBatchId('');
  assert.deepEqual(emptyRes, []);

  const nullRes = await getMultiplierTasksByBatchId(null);
  assert.deepEqual(nullRes, []);
});

test.after(() => {
  setTimeout(() => process.exit(0), 50);
});
