import { parseAtomicArgs, runRemoteScript, buildRollbackScript } from './lib/macmini-atomic.js';
import { pathToFileURL } from 'node:url';

export function main(argv = process.argv.slice(2)) {
  const args = parseAtomicArgs(argv);
  if (!args.apply || !args.confirmDev) {
    console.log(JSON.stringify({ mode: 'dry-run', environment: 'dev', target_release: args.release || 'previous' }, null, 2));
    return;
  }
  runRemoteScript(buildRollbackScript({ targetRelease: args.release }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
