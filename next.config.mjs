/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', '@imgly/background-removal-node'],
  turbopack: {},
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/public/*.txt',
          '**/public/*.log',
          '**/data/**',
          '**/.git/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
