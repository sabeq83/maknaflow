import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

test('phase-0 foundation does not import legacy execution internals', () => {
  const forbidden = [
    'scheduler-processors', 'campaign-scheduler',
    're-multiplier-worker', 'prompts'
  ];
  const files = [
    'lib/affiliate-studio-contract.js',
    'lib/affiliate-studio-feature-flags.js',
    'lib/affiliate-studio-access.js',
    'lib/affiliate-studio-connector-registry.js',
    'lib/affiliate-studio-audit.js',
    'app/api/v2/affiliate-studio/capabilities/route.js',
    'app/api/v2/affiliate-studio/feature-flags/route.js'
  ];

  for (const file of files) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    for (const item of forbidden) {
      assert.equal(
        content.includes(item),
        false,
        `File ${file} must not import or reference legacy internal: ${item}`
      );
    }
  }
});
