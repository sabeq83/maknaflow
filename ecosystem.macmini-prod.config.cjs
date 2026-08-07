/**
 * MAKNA Flow — PM2 Ecosystem Config untuk Mac Mini (Production macOS)
 * File: ecosystem.macmini-prod.config.cjs
 *
 * Path ini dinamis mendeteksi lokasi direktori saat dijalankan di macOS.
 * Start: pm2 start ecosystem.macmini-prod.config.cjs --env production
 */

const path = require('path');
const APP_DIR = path.resolve(__dirname);

module.exports = {
  apps: [
    // ── Web UI (Next.js) ────────────────────────────────────────────────
    {
      name: 'maknaflow-prod-ui',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 5000',
      cwd: APP_DIR,
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 3000,
      env_production: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        NODE_ROLE: 'standalone',
        PORT: 5000,
        HOSTNAME: '0.0.0.0',
        TZ: 'Asia/Jakarta',
      },
      // Log output
      out_file: `${APP_DIR}/logs/prod-ui.out.log`,
      error_file: `${APP_DIR}/logs/prod-ui.err.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // ── API Server (Express.js) ─────────────────────────────────────────
    {
      name: 'maknaflow-prod-api',
      script: 'apps/api/server.js',
      cwd: APP_DIR,
      interpreter: 'node',
      node_args: '--env-file=' + path.resolve(APP_DIR, '.env.local'),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 2000,
      env_production: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        NODE_ROLE: 'standalone',
        API_PORT: 6000,
        API_HOST: '0.0.0.0',
        TZ: 'Asia/Jakarta',
      },
      // Log output
      out_file: `${APP_DIR}/logs/prod-api.out.log`,
      error_file: `${APP_DIR}/logs/prod-api.err.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
