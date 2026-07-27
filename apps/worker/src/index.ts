import dotenv from "dotenv";
import Redis from "ioredis";
import { prisma } from "@svt/db";
import { createWorker, QUEUE_NAMES } from "@svt/queue";
import { processSourceAssetJob, type SourceAssetJobData } from "./jobs/source-asset-pipeline";
import {
  processClipCandidateDetectionJob,
  type ClipCandidateDetectionJobData,
} from "./jobs/clip-candidate-detection";
import { processGenerateThumbnailJob, type GenerateThumbnailJobData } from "./jobs/generate-thumbnail";
import { processGeneratePostCopyJob, type GeneratePostCopyJobData } from "./jobs/generate-post-copy";
import { startInngestConnection } from "./inngest-server";

// Skipped in production: `start:prod` already loads .env.production via
// Node's --env-file flag. Loading the default .env here too (dotenv's
// fallback filename) would leak local-dev-only values like INNGEST_DEV="1"
// into the production run, forcing Inngest's connect() into dev mode.
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const BRAND_DISCOVERY_INTERVAL_MS = 60_000;

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

/**
 * One BullMQ Worker per (job type, brand), each with its own small
 * concurrency budget — so a brand with a large backlog only ever competes
 * with its own queue, never starves another brand's jobs. New brands are
 * picked up by the periodic rescan below without a worker restart.
 */
function spinUpWorkersForBrand(brandId: string): void {
  const sourceAssetWorker = createWorker<SourceAssetJobData>(
    QUEUE_NAMES.sourceAssetPipeline,
    brandId,
    processSourceAssetJob,
    { concurrency: 2 },
  );
  sourceAssetWorker.on("completed", (job) => {
    console.log(`[worker] [brand ${brandId}] source-asset-pipeline job ${job.id} completed`);
  });
  sourceAssetWorker.on("failed", (job, err) => {
    console.error(`[worker] [brand ${brandId}] source-asset-pipeline job ${job?.id} failed:`, err.message);
  });

  const candidateWorker = createWorker<ClipCandidateDetectionJobData>(
    QUEUE_NAMES.clipCandidateDetection,
    brandId,
    processClipCandidateDetectionJob,
    { concurrency: 2 },
  );
  candidateWorker.on("completed", (job) => {
    console.log(`[worker] [brand ${brandId}] clip-candidate-detection job ${job.id} completed`);
  });
  candidateWorker.on("failed", (job, err) => {
    console.error(`[worker] [brand ${brandId}] clip-candidate-detection job ${job?.id} failed:`, err.message);
  });

  const thumbnailWorker = createWorker<GenerateThumbnailJobData>(
    QUEUE_NAMES.generateThumbnail,
    brandId,
    processGenerateThumbnailJob,
    { concurrency: 2 },
  );
  thumbnailWorker.on("completed", (job) => {
    console.log(`[worker] [brand ${brandId}] generate-thumbnail job ${job.id} completed`);
  });
  thumbnailWorker.on("failed", (job, err) => {
    console.error(`[worker] [brand ${brandId}] generate-thumbnail job ${job?.id} failed:`, err.message);
  });

  const postCopyWorker = createWorker<GeneratePostCopyJobData>(
    QUEUE_NAMES.generatePostCopy,
    brandId,
    processGeneratePostCopyJob,
    { concurrency: 2 },
  );
  postCopyWorker.on("completed", (job) => {
    console.log(`[worker] [brand ${brandId}] generate-post-copy job ${job.id} completed`);
  });
  postCopyWorker.on("failed", (job, err) => {
    console.error(`[worker] [brand ${brandId}] generate-post-copy job ${job?.id} failed:`, err.message);
  });
}

async function discoverBrandsAndSpinUpWorkers(knownBrandIds: Set<string>): Promise<void> {
  const brands = await prisma.brand.findMany({ select: { id: true } });
  for (const { id: brandId } of brands) {
    if (knownBrandIds.has(brandId)) continue;
    knownBrandIds.add(brandId);
    spinUpWorkersForBrand(brandId);
    console.log(`[worker] spun up per-brand queue workers for brand ${brandId}`);
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

  const knownBrandIds = new Set<string>();
  await discoverBrandsAndSpinUpWorkers(knownBrandIds);
  setInterval(() => {
    discoverBrandsAndSpinUpWorkers(knownBrandIds).catch((err) => {
      console.error("[worker] brand discovery rescan failed:", err);
    });
  }, BRAND_DISCOVERY_INTERVAL_MS);

  console.log(
    `[worker] listening on per-brand queues for "${QUEUE_NAMES.sourceAssetPipeline}", ` +
      `"${QUEUE_NAMES.clipCandidateDetection}", "${QUEUE_NAMES.generateThumbnail}", ` +
      `"${QUEUE_NAMES.generatePostCopy}" (${knownBrandIds.size} brand(s) so far)`,
  );

  await startInngestConnection();
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
