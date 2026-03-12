import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const agentQueue = new Queue("agent", { connection });
export const emailQueue = new Queue("email", { connection });

export { connection as redisConnection };
