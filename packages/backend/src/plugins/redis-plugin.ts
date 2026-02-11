import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
    redisWorker: Redis;
  }
}

async function redisPlugin(fastify: FastifyInstance) {
  const redis = new Redis(fastify.config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  // Separate connection for BullMQ workers (requires maxRetriesPerRequest: null)
  const redisWorker = new Redis(fastify.config.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  await redis.connect();
  await redisWorker.connect();

  fastify.decorate("redis", redis);
  fastify.decorate("redisWorker", redisWorker);

  fastify.addHook("onClose", async () => {
    await redis.quit();
    await redisWorker.quit();
  });

  fastify.log.info("Redis connected");
}

export default fp(redisPlugin, { name: "redis" });
