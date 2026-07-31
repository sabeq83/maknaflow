import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || process.env.PGHOST || '100.78.186.123';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

let redisConnection = null;

export function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: null, // Required by BullMQ
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    redisConnection.on('error', (err) => {
      console.error('[Redis Client Error]', err);
    });

    redisConnection.on('connect', () => {
      console.log(`[Redis] Connected successfully to ${REDIS_HOST}:${REDIS_PORT}`);
    });
  }
  return redisConnection;
}
