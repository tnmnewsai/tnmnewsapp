import fs from "node:fs";

export interface GenerateSegmentImageInput {
  prompt: string;
  width: number;
  height: number;
  outputPath: string;
  /** Distinct per segment so Pollinations doesn't cache identical output for a repeated prompt. */
  seed?: number;
}

const POLLINATIONS_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [2000, 5000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pollinations.ai — free, no API key, no signup. It's a community-run
 * service with no formal SLA and rate-limits concurrent requests (observed
 * a real 429 during testing), so retries back off instead of hammering it
 * immediately again.
 */
export async function generateSegmentImage(input: GenerateSegmentImageInput): Promise<void> {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(input.prompt)}` +
    `?width=${input.width}&height=${input.height}&nologo=true` +
    (input.seed !== undefined ? `&seed=${input.seed}` : "");

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 2000);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), POLLINATIONS_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Pollinations returned ${res.status} ${res.statusText}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(input.outputPath, buffer);
        return;
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Failed to generate image from Pollinations after ${RETRY_DELAYS_MS.length + 1} attempts: ${String(lastError)}`,
  );
}
