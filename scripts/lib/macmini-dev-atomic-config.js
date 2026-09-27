export const DEV_ATOMIC_CONFIG = Object.freeze({
  environment: 'dev',
  host: 'masbenu@100.95.245.55',
  repositoryUrl: 'https://github.com/sabeq83/maknaflow.git',
  legacyRoot: '/Users/masbenu/maknaflow-dev',
  atomicRoot: '/Users/masbenu/maknaflow-dev-atomic',
  sourceRoot: '/Users/masbenu/maknaflow-dev-atomic/source',
  releasesRoot: '/Users/masbenu/maknaflow-dev-atomic/releases',
  sharedRoot: '/Users/masbenu/maknaflow-dev-atomic/shared',
  currentLink: '/Users/masbenu/maknaflow-dev-atomic/current',
  uiPort: 5020,
  apiPort: 7020,
  schema: 'dev',
  pm2Apps: ['maknaflow-dev-ui', 'maknaflow-dev-api'],
  defaultRetention: 5,
  sshOptions: ['-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=10', '-o', 'ConnectTimeout=30']
});

export function assertDevOnlyEnvironment(environment = 'dev') {
  if (environment !== 'dev') {
    throw new Error(`Atomic deployment pilot hanya mengizinkan environment dev, diterima: ${environment}`);
  }
  return DEV_ATOMIC_CONFIG;
}
