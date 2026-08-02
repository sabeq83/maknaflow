#!/usr/bin/env node
import process from 'node:process';
import { loadStagingEnv } from './local-staging/env.js';

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

async function readHidden(prompt) {
  if (!process.stdin.isTTY) throw new Error('Gunakan MAKNA_ADMIN_BOOTSTRAP_PASSWORD saat stdin bukan TTY.');
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = char => {
      if (char === '\u0003') {
        cleanup();
        reject(new Error('Dibatalkan.'));
      } else if (char === '\r' || char === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolve(value);
      } else if (char === '\u007f') {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  const [, , command, ...args] = process.argv;
  if (command !== 'create-superadmin') {
    console.log('Usage: npm run admin -- create-superadmin --username <name> --email <email> [--staging]');
    return;
  }
  if (args.includes('--staging')) Object.assign(process.env, loadStagingEnv());
  const username = option(args, '--username');
  const email = option(args, '--email');
  if (!username) throw new Error('--username wajib diisi.');
  const password = process.env.MAKNA_ADMIN_BOOTSTRAP_PASSWORD || await readHidden('Password superadmin: ');
  const confirmation = process.env.MAKNA_ADMIN_BOOTSTRAP_PASSWORD || await readHidden('Ulangi password: ');
  if (password !== confirmation) throw new Error('Konfirmasi password tidak cocok.');
  const { createSuperadmin } = await import('../lib/superadmin-service.js');
  const user = await createSuperadmin({ username, email, password }, { bootstrap: true });
  console.log(`Superadmin ${user.username} berhasil dibuat.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
