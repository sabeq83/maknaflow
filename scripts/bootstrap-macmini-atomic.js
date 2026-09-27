import { parseAtomicArgs, runRemoteScript, buildBootstrapScript } from './lib/macmini-atomic.js';
import { pathToFileURL } from 'node:url';

export function main(argv = process.argv.slice(2)) {
  const args = parseAtomicArgs(argv);
  if (args.apply && !args.confirmDev) throw new Error('Bootstrap Dev membutuhkan --apply --confirm-dev.');
  runRemoteScript(buildBootstrapScript({ apply: args.apply && args.confirmDev }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
