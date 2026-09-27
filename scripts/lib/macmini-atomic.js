import { execFileSync } from 'node:child_process';
import { DEV_ATOMIC_CONFIG, assertDevOnlyEnvironment } from './macmini-dev-atomic-config.js';

export function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

export function parseAtomicArgs(argv = []) {
  const valueOf = flag => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : null;
  };
  const environment = valueOf('--environment') || 'dev';
  assertDevOnlyEnvironment(environment);
  const keep = Number(valueOf('--keep') || DEV_ATOMIC_CONFIG.defaultRetention);
  if (!Number.isInteger(keep) || keep < 2 || keep > 20) {
    throw new Error('--keep wajib berupa integer 2-20.');
  }
  return {
    environment,
    ref: valueOf('--ref'),
    release: valueOf('--release'),
    keep,
    apply: argv.includes('--apply'),
    confirmDev: argv.includes('--confirm-dev'),
    dryRun: !argv.includes('--apply') || argv.includes('--dry-run')
  };
}

export function runLocal(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe']
  }).trim();
}

export function resolveLocalGitSha(ref = 'HEAD') {
  const sha = runLocal('git', ['rev-parse', '--verify', `${ref}^{commit}`]);
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error(`Git ref tidak valid: ${ref}`);
  return sha.toLowerCase();
}

export function runRemoteScript(script, { capture = false } = {}) {
  return execFileSync('ssh', [...DEV_ATOMIC_CONFIG.sshOptions, DEV_ATOMIC_CONFIG.host, 'bash', '-s'], {
    input: script,
    encoding: 'utf8',
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
    timeout: 600000
  });
}

export function buildBootstrapScript({ apply = false } = {}) {
  const c = DEV_ATOMIC_CONFIG;
  const prefix = [
    'set -euo pipefail',
    'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"',
    `legacy=${shellQuote(c.legacyRoot)}`,
    `root=${shellQuote(c.atomicRoot)}`,
    `source_root=${shellQuote(c.sourceRoot)}`,
    `shared=${shellQuote(c.sharedRoot)}`,
    `repo=${shellQuote(c.repositoryUrl)}`
  ].join('\n');
  if (!apply) {
    return `${prefix}
echo "mode=dry-run"
test -d "$legacy"
test -f "$legacy/.env.local"
git ls-remote "$repo" HEAD >/dev/null
for rel in data logs public/uploads public/temp; do
  if test -e "$legacy/$rel"; then du -sh "$legacy/$rel"; else echo "missing $rel"; fi
done
echo "atomic_root=$root"
echo "bootstrap_ready=true"`;
  }
  return `${prefix}
echo "mode=apply"
test -d "$legacy"
test -f "$legacy/.env.local"
mkdir -p "$root" "$root/releases" "$shared" "$shared/public" "$shared/public-runtime-logs"
if test ! -d "$source_root/.git"; then
  git clone --no-checkout "$repo" "$source_root"
else
  git -C "$source_root" remote set-url origin "$repo"
fi
for rel in data logs public/uploads public/temp; do
  mkdir -p "$shared/$rel"
  if test -d "$legacy/$rel"; then rsync -a "$legacy/$rel/" "$shared/$rel/"; fi
done
if test ! -f "$shared/.env.local"; then cp -p "$legacy/.env.local" "$shared/.env.local"; fi
find "$legacy/public" -maxdepth 1 -type f -name '*logs*.txt' -exec cp -p {} "$shared/public-runtime-logs/" \\; 2>/dev/null || true
chmod 600 "$shared/.env.local"
git -C "$source_root" fetch --prune --tags origin
echo "bootstrap_ready=true"
for rel in data logs public/uploads public/temp; do
  printf '%s files=' "$rel"; find "$shared/$rel" -type f | wc -l | tr -d ' '; echo
done`;
}

export function buildDeployScript({ sha, keep = DEV_ATOMIC_CONFIG.defaultRetention } = {}) {
  if (!/^[0-9a-f]{40}$/i.test(sha || '')) throw new Error('Deploy membutuhkan immutable 40-character Git SHA.');
  const c = DEV_ATOMIC_CONFIG;
  return `set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
root=${shellQuote(c.atomicRoot)}
source_root=${shellQuote(c.sourceRoot)}
releases=${shellQuote(c.releasesRoot)}
shared=${shellQuote(c.sharedRoot)}
current=${shellQuote(c.currentLink)}
legacy=${shellQuote(c.legacyRoot)}
sha=${shellQuote(sha)}
keep=${Number(keep)}
lock="$root/.deploy-lock"
if ! mkdir "$lock" 2>/dev/null; then echo "Deployment Dev lain sedang berjalan: $lock" >&2; exit 73; fi
cleanup() { rmdir "$lock" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
test -d "$source_root/.git"
test -f "$shared/.env.local"
git -C "$source_root" fetch --prune --tags origin
git -C "$source_root" cat-file -e "$sha^{commit}"
release_id="$(date -u +%Y%m%dT%H%M%SZ)-$(printf '%s' "$sha" | cut -c1-12)"
release="$releases/$release_id"
test ! -e "$release"
previous=""
if test -L "$current"; then previous="$(readlink "$current")"; fi
git -C "$source_root" worktree add --detach "$release" "$sha"
rollback_pre_activation() {
  git -C "$source_root" worktree remove --force "$release" 2>/dev/null || true
}
trap 'rollback_pre_activation; cleanup' ERR
rm -rf "$release/data" "$release/logs" "$release/public/uploads" "$release/public/temp"
ln -s "$shared/data" "$release/data"
ln -s "$shared/logs" "$release/logs"
mkdir -p "$release/public"
ln -s "$shared/public/uploads" "$release/public/uploads"
ln -s "$shared/public/temp" "$release/public/temp"
ln -s "$shared/.env.local" "$release/.env.local"
for log_file in "$shared/public-runtime-logs"/*logs*.txt; do
  test -e "$log_file" || continue
  ln -s "$log_file" "$release/public/$(basename "$log_file")"
done
cd "$release"
npm ci --no-audit --no-fund
DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build
printf '{"environment":"dev","release_id":"%s","git_sha":"%s","previous":"%s","built_at":"%s"}\n' \
  "$release_id" "$sha" "$previous" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$release/deployment-manifest.json"
ln -s "$release" "$root/current.next"
mv -h -f "$root/current.next" "$current"
rollback_after_activation() {
  status=$?
  trap - ERR
  if test -n "$previous"; then rollback_target="$previous"; else rollback_target="$legacy"; fi
  ln -s "$rollback_target" "$root/current.rollback"
  mv -h -f "$root/current.rollback" "$current"
  pm2 startOrGracefulReload "$rollback_target/ecosystem.macmini.config.cjs" --only ${c.pm2Apps.join(',')} --update-env || true
  cleanup
  exit "$status"
}
trap rollback_after_activation ERR
pm2 startOrGracefulReload "$release/ecosystem.macmini.config.cjs" --only ${c.pm2Apps.join(',')} --update-env
healthy=false
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  ui_code="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:${c.uiPort}/login || true)"
  api_code="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:${c.apiPort}/health || true)"
  if test "$ui_code" = 200 && test "$api_code" = 200; then healthy=true; break; fi
  sleep 5
done
if test "$healthy" != true; then
  echo "Health check gagal; rollback Dev." >&2
  false
fi
printf '{"environment":"dev","release_id":"%s","git_sha":"%s","previous":"%s","activated_at":"%s","health":"passed"}\n' \
  "$release_id" "$sha" "$previous" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$release/deployment-manifest.json"
active="$(readlink "$current")"
trap cleanup ERR
count=0
for candidate in $(find "$releases" -mindepth 1 -maxdepth 1 -type d -print | sort -r); do
  if test "$candidate" = "$active" || test "$candidate" = "$previous"; then continue; fi
  count=$((count + 1))
  if test "$count" -gt "$keep"; then git -C "$source_root" worktree remove --force "$candidate"; fi
done
echo "deployment_success=true"
echo "release_id=$release_id"
echo "git_sha=$sha"
echo "previous=$previous"
echo "current=$release"`;
}

export function buildRollbackScript({ targetRelease = null } = {}) {
  const c = DEV_ATOMIC_CONFIG;
  const requested = targetRelease ? shellQuote(targetRelease) : "''";
  return `set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
root=${shellQuote(c.atomicRoot)}
current=${shellQuote(c.currentLink)}
requested=${requested}
test -L "$current"
active="$(readlink "$current")"
if test -n "$requested"; then
  target=${shellQuote(c.releasesRoot)}/"$requested"
else
  target="$(/opt/homebrew/bin/node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(p.previous||'')" "$active/deployment-manifest.json")"
fi
test -n "$target"
test -d "$target"
test -f "$target/deployment-manifest.json" || test "$target" = ${shellQuote(c.legacyRoot)}
ln -s "$target" "$root/current.rollback"
mv -h -f "$root/current.rollback" "$current"
pm2 startOrGracefulReload "$target/ecosystem.macmini.config.cjs" --only ${c.pm2Apps.join(',')} --update-env
ui_code="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:${c.uiPort}/login)"
api_code="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:${c.apiPort}/health)"
test "$ui_code" = 200
test "$api_code" = 200
echo "rollback_success=true"
echo "from=$active"
echo "current=$target"`;
}
