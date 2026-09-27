import { parseAtomicArgs, runRemoteScript, buildRollbackScript } from './lib/macmini-atomic.js';
import { pathToFileURL } from 'node:url';

export function main(argv = process.argv.slice(2)) {
  const args = parseAtomicArgs(argv, { defaultEnvironment: 'staging' });
  if (args.environment !== 'staging') throw new Error('CLI ini hanya untuk Staging.');
  if (!args.apply || !args.confirmed) {
    console.log(JSON.stringify({ mode: 'dry-run', environment: 'staging', target_release: args.release || 'previous' }, null, 2));
    return;
  }
  runRemoteScript(buildRollbackScript({ targetRelease: args.release, config: args.config }), { config: args.config });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
