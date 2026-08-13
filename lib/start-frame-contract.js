export function calculateStartFrameAggregate({ visualMode, expectedCount, paths }) {
  if (visualMode !== 'hybrid_lock') return { status: 'skipped', expected: 0, completed: 0, ready: true };
  const expected = Math.max(0, Number(expectedCount) || 0);
  const completed = (Array.isArray(paths) ? paths : []).slice(0, expected).filter(Boolean).length;
  return { status: completed === expected && expected > 0 ? 'completed' : (completed > 0 ? 'partial' : 'failed'), expected, completed, ready: completed === expected && expected > 0 };
}
