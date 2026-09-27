import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAtomicArgs, buildBootstrapScript, buildDeployScript, buildRollbackScript } from '../scripts/lib/macmini-atomic.js';
import { STAGING_ATOMIC_CONFIG } from '../scripts/lib/macmini-dev-atomic-config.js';

const SHA = 'a'.repeat(40);

test('atomic deployment accepts dev and staging but rejects production', () => {
  assert.equal(parseAtomicArgs(['--environment', 'dev']).environment, 'dev');
  assert.equal(parseAtomicArgs(['--environment', 'staging']).environment, 'staging');
  assert.throws(() => parseAtomicArgs(['--environment', 'production']), /dev atau staging/);
});

test('staging atomic config is isolated from Dev and Production', () => {
  const script = buildDeployScript({ sha: SHA, keep: 5, config: STAGING_ATOMIC_CONFIG });
  assert.match(script, /maknaflow-staging-atomic/);
  assert.match(script, /maknaflow-staging-ui maknaflow-staging-api/);
  assert.match(script, /PG_SEARCH_PATH='staging'/);
  assert.match(script, /127\.0\.0\.1:5010\/login/);
  assert.match(script, /127\.0\.0\.1:7010\/health/);
  assert.match(script, /"environment":"staging"/);
  assert.doesNotMatch(script, /maknaflow-dev|maknaflow-production|5000|6000|5020|7020/);
});

test('staging apply requires its explicit confirmation flag', () => {
  const args = parseAtomicArgs(['--apply', '--confirm-staging'], { defaultEnvironment: 'staging' });
  assert.equal(args.environment, 'staging');
  assert.equal(args.confirmed, true);
  assert.equal(args.config.schema, 'staging');
  assert.equal(parseAtomicArgs(['--apply'], { defaultEnvironment: 'staging' }).confirmed, false);
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
  assert.match(script, /DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH='dev'/);
  assert.match(script, /ln -s "\$shared\/data"/);
  assert.match(script, /ln -s "\$shared\/public\/uploads"/);
  assert.match(script, /rm -f "\$release_log"[\s\S]*ln -s "\$log_file" "\$release_log"/);
  assert.match(script, /if test -z "\$previous"; then[\s\S]*rsync -a "\$legacy\/\$rel\/" "\$shared\/\$rel\/"/);
  assert.doesNotMatch(script, /rsync[^\n]*--delete/);
  assert.doesNotMatch(script, /5010|7010|5000|6000|schema: 'staging'|schema: 'public'/);
});

test('deploy has lock, health checks, rollback, manifest, and safe retention guards', () => {
  const script = buildDeployScript({ sha: SHA, keep: 5 });
  assert.match(script, /\.deploy-lock/);
  assert.match(script, /127\.0\.0\.1:5020\/login/);
  assert.match(script, /127\.0\.0\.1:7020\/health/);
  assert.match(script, /Health check gagal; rollback dev/);
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
  assert.match(script, /memulihkan release asal dev/);
  assert.doesNotMatch(script, /maknaflow-staging|maknaflow-production/);
});
