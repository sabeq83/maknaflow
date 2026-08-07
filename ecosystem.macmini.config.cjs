/**
 * MAKNA Flow — PM2 Ecosystem Config untuk Mac Mini (Staging macOS)
 * File: ecosystem.macmini.config.cjs
 *
 * Path ini dinamis mendeteksi lokasi direktori saat dijalankan di macOS.
 * Start: pm2 start ecosystem.macmini.config.cjs --env staging
 */

const path = require('path');
const APP_DIR = path.resolve(__dirname);

module.exports = {
  apps: [
    // ── Web UI (Next.js) ────────────────────────────────────────────────
    {
      name: 'maknaflow-staging-ui',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 5010',
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
        HOSTNAME: '0.0.0.0',
        TZ: 'Asia/Jakarta',
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
      node_args: '--env-file=' + path.resolve(APP_DIR, '.env.local'),
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
        API_HOST: '0.0.0.0',
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
