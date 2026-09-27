import { parseAtomicArgs, resolveLocalGitSha, runRemoteScript, buildDeployScript } from './lib/macmini-atomic.js';
import { pathToFileURL } from 'node:url';

export function main(argv = process.argv.slice(2)) {
  const args = parseAtomicArgs(argv);
  const sha = resolveLocalGitSha(args.ref || 'HEAD');
  if (args.dryRun) {
    console.log(JSON.stringify({ mode: 'dry-run', environment: 'dev', git_sha: sha, keep: args.keep }, null, 2));
    return;
  }
  if (!args.confirmDev) throw new Error('Deploy Dev membutuhkan --apply --confirm-dev.');
  runRemoteScript(buildDeployScript({ sha, keep: args.keep }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
