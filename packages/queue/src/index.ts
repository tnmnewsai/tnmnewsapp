import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | undefined;

/**
 * Shared BullMQ Redis connection. One queue per pipeline stage today; per-brand
 * concurrency isolation (so one brand's batch can't starve another's) is
 * deferred to Milestone 14 rather than built speculatively now.
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
 * Cached per name — callers (e.g. a server action on every request) don't
 * each open a new connection, and nobody needs to remember to close one.
 */
export function createQueue<DataType>(name: string): Queue<DataType> {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue<DataType>(name, { connection: getConnection() });
    queues.set(name, queue);
  }
  return queue as Queue<DataType>;
}

export function createWorker<DataType>(
  name: string,
  processor: Processor<DataType>,
  opts?: Partial<WorkerOptions>,
): Worker<DataType> {
  return new Worker<DataType>(name, processor, { connection: getConnection(), ...opts });
}

export const QUEUE_NAMES = {
  sourceAssetPipeline: "svt-source-asset-pipeline",
} as const;
