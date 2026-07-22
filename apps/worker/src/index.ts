import "dotenv/config";
import Redis from "ioredis";
import { prisma } from "@svt/db";
import { createWorker, QUEUE_NAMES } from "@svt/queue";
import { processSourceAssetJob, type SourceAssetJobData } from "./jobs/source-asset-pipeline";

async function checkPostgres(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error("[worker] Postgres check failed:", err);
    return false;
  }
}

async function checkRedis(redis: Redis): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (err) {
    console.error("[worker] Redis check failed:", err);
    return false;
  }
}

async function main() {
  console.log("[worker] starting…");

  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  const [pgOk, redisOk] = await Promise.all([checkPostgres(), (async () => {
    try {
      await redis.connect();
    } catch {
      // handled by checkRedis returning false below
    }
    return checkRedis(redis);
  })()]);

  console.log(`[worker] Postgres: ${pgOk ? "connected" : "UNAVAILABLE"}`);
  console.log(`[worker] Redis:    ${redisOk ? "connected" : "UNAVAILABLE"}`);

  const worker = createWorker<SourceAssetJobData>(
    QUEUE_NAMES.sourceAssetPipeline,
    processSourceAssetJob,
    { concurrency: 2 },
  );

  worker.on("completed", (job) => {
    console.log(`[worker] source-asset-pipeline job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[worker] source-asset-pipeline job ${job?.id} failed:`, err.message);
  });

  console.log(`[worker] listening on queue "${QUEUE_NAMES.sourceAssetPipeline}"`);
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
