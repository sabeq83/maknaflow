import { parseAtomicArgs, runRemoteScript, buildBootstrapScript } from './lib/macmini-atomic.js';
import { pathToFileURL } from 'node:url';

export function main(argv = process.argv.slice(2)) {
  const args = parseAtomicArgs(argv, { defaultEnvironment: 'staging' });
  if (args.environment !== 'staging') throw new Error('CLI ini hanya untuk Staging.');
  if (args.apply && !args.confirmed) throw new Error('Bootstrap Staging membutuhkan --apply --confirm-staging.');
  runRemoteScript(buildBootstrapScript({ apply: args.apply && args.confirmed, config: args.config }), { config: args.config });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
