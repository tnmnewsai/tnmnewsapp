import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | undefined;

/**
 * Shared BullMQ Redis connection.
 */
function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

const queues = new Map<string, Queue>();

/**
 * One BullMQ queue per (job type, brand) — not one global queue per job
 * type — so a brand with a large backlog only ever competes with its own
 * queue's worker concurrency, never another brand's.
 */
export function queueName(baseName: string, brandId: string): string {
  return `${baseName}__${brandId}`;
}

/**
 * Cached per name — callers (e.g. a server action on every request) don't
 * each open a new connection, and nobody needs to remember to close one.
 */
export function createQueue<DataType>(baseName: string, brandId: string): Queue<DataType> {
  const name = queueName(baseName, brandId);
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue<DataType>(name, { connection: getConnection() });
    queues.set(name, queue);
  }
  return queue as Queue<DataType>;
}

export function createWorker<DataType>(
  baseName: string,
  brandId: string,
  processor: Processor<DataType>,
  opts?: Partial<WorkerOptions>,
): Worker<DataType> {
  return new Worker<DataType>(queueName(baseName, brandId), processor, {
    connection: getConnection(),
    ...opts,
  });
}

/**
 * Job counts across every brand's queue for one job type — used by the
 * admin ops page. Redis has no native "list queues by prefix" for BullMQ,
 * so callers pass the known brand ids (from the DB) rather than us
 * discovering queue names by scanning keys.
 */
export async function getQueueJobCounts(
  baseName: string,
  brandId: string,
): Promise<{ waiting: number; active: number; completed: number; failed: number; delayed: number }> {
  const queue = createQueue(baseName, brandId);
  const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
  };
}

export const QUEUE_NAMES = {
  sourceAssetPipeline: "svt-source-asset-pipeline",
  clipCandidateDetection: "svt-clip-candidate-detection",
  generateThumbnail: "svt-generate-thumbnail",
  generatePostCopy: "svt-generate-post-copy",
} as const;
