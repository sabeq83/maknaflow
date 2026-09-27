import { parseAtomicArgs, resolveLocalGitSha, runRemoteScript, buildDeployScript } from './lib/macmini-atomic.js';
import { pathToFileURL } from 'node:url';

export function main(argv = process.argv.slice(2)) {
  const args = parseAtomicArgs(argv, { defaultEnvironment: 'staging' });
  if (args.environment !== 'staging') throw new Error('CLI ini hanya untuk Staging.');
  const sha = resolveLocalGitSha(args.ref || 'HEAD');
  if (args.dryRun) {
    console.log(JSON.stringify({ mode: 'dry-run', environment: 'staging', git_sha: sha, keep: args.keep }, null, 2));
    return;
  }
  if (!args.confirmed) throw new Error('Deploy Staging membutuhkan --apply --confirm-staging.');
  runRemoteScript(buildDeployScript({ sha, keep: args.keep, config: args.config }), { config: args.config });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
