import { spawn } from 'child_process';
import path from 'path';
import { loadStagingEnv } from './env.js';

const env = loadStagingEnv();
const command = process.argv[2];
const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

const commands = {
  build: [process.execPath, [nextBin, 'build', '--webpack']],
  start: [process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', env.PORT]],
  api: [process.execPath, [path.join(process.cwd(), 'apps', 'api', 'server.js')]]
};

if (!commands[command]) {
  console.error('Usage: node scripts/local-staging/run.js <build|start|api>');
  process.exit(1);
}

const [executable, args] = commands[command];
const child = spawn(executable, args, { cwd: process.cwd(), env, stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
