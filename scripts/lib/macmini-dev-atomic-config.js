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
  confirmationFlag: '--confirm-dev',
  sshOptions: ['-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=10', '-o', 'ConnectTimeout=30']
});

export const STAGING_ATOMIC_CONFIG = Object.freeze({
  environment: 'staging',
  host: 'masbenu@100.95.245.55',
  repositoryUrl: 'https://github.com/sabeq83/maknaflow.git',
  legacyRoot: '/Users/masbenu/maknaflow-staging',
  atomicRoot: '/Users/masbenu/maknaflow-staging-atomic',
  sourceRoot: '/Users/masbenu/maknaflow-staging-atomic/source',
  releasesRoot: '/Users/masbenu/maknaflow-staging-atomic/releases',
  sharedRoot: '/Users/masbenu/maknaflow-staging-atomic/shared',
  currentLink: '/Users/masbenu/maknaflow-staging-atomic/current',
  uiPort: 5010,
  apiPort: 7010,
  schema: 'staging',
  pm2Apps: ['maknaflow-staging-ui', 'maknaflow-staging-api'],
  defaultRetention: 5,
  confirmationFlag: '--confirm-staging',
  sshOptions: ['-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=10', '-o', 'ConnectTimeout=30']
});

const CONFIGS = Object.freeze({ dev: DEV_ATOMIC_CONFIG, staging: STAGING_ATOMIC_CONFIG });

export function getAtomicConfig(environment = 'dev') {
  const config = CONFIGS[environment];
  if (!config) throw new Error(`Atomic deployment hanya mengizinkan environment dev atau staging, diterima: ${environment}`);
  return config;
}

export function assertDevOnlyEnvironment(environment = 'dev') {
  if (environment !== 'dev') {
    throw new Error(`Atomic deployment pilot hanya mengizinkan environment dev, diterima: ${environment}`);
  }
  return DEV_ATOMIC_CONFIG;
}
