import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAtomicArgs, buildBootstrapScript, buildDeployScript, buildRollbackScript } from '../scripts/lib/macmini-atomic.js';

const SHA = 'a'.repeat(40);

test('atomic pilot rejects every environment except dev', () => {
  assert.equal(parseAtomicArgs(['--environment', 'dev']).environment, 'dev');
  assert.throws(() => parseAtomicArgs(['--environment', 'staging']), /hanya mengizinkan environment dev/);
  assert.throws(() => parseAtomicArgs(['--environment', 'production']), /hanya mengizinkan environment dev/);
});

test('bootstrap preserves legacy runtime and never uses rsync delete', () => {
  const script = buildBootstrapScript({ apply: true });
  assert.match(script, /maknaflow-dev-atomic/);
  assert.match(script, /rsync -a/);
  assert.match(script, /-exec cp -p \{\} .* \\;/);
  assert.doesNotMatch(script, /--delete/);
  assert.doesNotMatch(script, /rm -rf.*maknaflow-dev/);
});

test('deploy builds before atomic activation and shares mutable paths', () => {
  const script = buildDeployScript({ sha: SHA, keep: 5 });
  const buildAt = script.indexOf('npm run build');
  const activateAt = script.indexOf('mv -h -f "$root/current.next" "$current"');
  assert.ok(buildAt > 0 && activateAt > buildAt);
  assert.match(script, /DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev/);
  assert.match(script, /ln -s "\$shared\/data"/);
  assert.match(script, /ln -s "\$shared\/public\/uploads"/);
  assert.match(script, /rm -f "\$release_log"[\s\S]*ln -s "\$log_file" "\$release_log"/);
  assert.doesNotMatch(script, /5010|7010|5000|6000|schema: 'staging'|schema: 'public'/);
});

test('deploy has lock, health checks, rollback, manifest, and safe retention guards', () => {
  const script = buildDeployScript({ sha: SHA, keep: 5 });
  assert.match(script, /\.deploy-lock/);
  assert.match(script, /127\.0\.0\.1:5020\/login/);
  assert.match(script, /127\.0\.0\.1:7020\/health/);
  assert.match(script, /Health check gagal; rollback Dev/);
  assert.match(script, /deployment-manifest\.json/);
  assert.match(script, /candidate.*active.*candidate.*previous/);
  assert.match(script, /pm2 delete maknaflow-dev-ui maknaflow-dev-api/);
  assert.match(script, /pm2_env\.pm_cwd!==expected/);
  assert.doesNotMatch(script, /startOrGracefulReload/);
});

test('deploy requires immutable sha and bounded retention', () => {
  assert.throws(() => buildDeployScript({ sha: 'main' }), /immutable 40-character Git SHA/);
  assert.throws(() => parseAtomicArgs(['--keep', '1']), /integer 2-20/);
  assert.equal(parseAtomicArgs(['--keep', '7']).keep, 7);
});

test('rollback only targets Dev atomic releases and checks both Dev endpoints', () => {
  const script = buildRollbackScript({ targetRelease: '20260927T000000Z-aaaaaaaaaaaa' });
  assert.match(script, /maknaflow-dev-atomic\/releases/);
  assert.match(script, /127\.0\.0\.1:5020\/login/);
  assert.match(script, /127\.0\.0\.1:7020\/health/);
  assert.match(script, /pm2_env\.pm_cwd!==expected/);
  assert.match(script, /for attempt in 1 2 3 4 5 6 7 8 9 10 11 12/);
  assert.match(script, /recover_active_release/);
  assert.match(script, /memulihkan release asal Dev/);
  assert.doesNotMatch(script, /maknaflow-staging|maknaflow-production/);
});
