/**
 * MAKNA Flow — PM2 Ecosystem Config untuk Node 2 (WSL 2 Staging)
 * File: ecosystem.staging.config.cjs
 *
 * Gunakan format .cjs karena PM2 memerlukan CommonJS untuk ecosystem config.
 * Path ini adalah path LINUX di dalam WSL 2.
 *
 * Start: pm2 start ecosystem.staging.config.cjs --env staging
 */

const LINUX_USER = process.env.USER || 'sabeqmursyid';
const APP_DIR = `/home/${LINUX_USER}/maknaflow-staging`;

module.exports = {
  apps: [
    // ── Web UI (Next.js) ────────────────────────────────────────────────
    {
      name: 'maknaflow-staging-ui',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 5010',
      cwd: APP_DIR,
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 3000,
      env_staging: {
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        NODE_ROLE: 'standalone',
        PORT: 5010,
        HOSTNAME: '127.0.0.1',
        TZ: 'Asia/Jakarta',
        // Var lainnya dibaca dari .env.staging.local via source sebelum pm2 start
      },
      // Log output
      out_file: `${APP_DIR}/logs/staging-ui.out.log`,
      error_file: `${APP_DIR}/logs/staging-ui.err.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // ── API Server (Express.js) ─────────────────────────────────────────
    {
      name: 'maknaflow-staging-api',
      script: 'apps/api/server.js',
      cwd: APP_DIR,
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 2000,
      env_staging: {
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        NODE_ROLE: 'standalone',
        API_PORT: 7010,
        API_HOST: '127.0.0.1',
        TZ: 'Asia/Jakarta',
      },
      // Log output
      out_file: `${APP_DIR}/logs/staging-api.out.log`,
      error_file: `${APP_DIR}/logs/staging-api.err.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
