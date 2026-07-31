module.exports = {
  apps: [
    {
      name: 'maknaflow-prod-ui',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 5000',
      cwd: '/home/sabeqmursyid/maknaflow',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'maknaflow-prod-api',
      script: 'apps/api/server.js',
      cwd: '/home/sabeqmursyid/maknaflow',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 6000
      }
    }
  ]
};
