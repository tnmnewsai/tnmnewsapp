import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import type { ModerationDetail, ModerationItem, ModerationResult } from "./types";

function toDataUrl(imagePath: string): string {
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).replace(".", "") || "png";
  return `data:image/${ext};base64,${buffer.toString("base64")}`;
}

/**
 * Runs every item through OpenAI's omni-moderation model in a single call —
 * it accepts a mixed array of text and image inputs and returns one result
 * per item, in order, so frames (extracted video stills) and text (captions/
 * overlay copy) can be checked together instead of one API call each.
 */
export async function runModeration(items: ModerationItem[]): Promise<ModerationResult> {
  if (items.length === 0) return { flagged: false, details: [] };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it to apps/worker/.env to enable moderation.");
  }

  const client = new OpenAI({ apiKey });

  const input = items.map((item) =>
    item.kind === "text"
      ? { type: "text" as const, text: item.text }
      : { type: "image_url" as const, image_url: { url: toDataUrl(item.imagePath) } },
  );

  const response = await client.moderations.create({ model: "omni-moderation-latest", input });

  const details: ModerationDetail[] = response.results.map((result, i) => {
    const item = items[i];
    if (!item) throw new Error("Moderation response length did not match the request.");

    const categories = Object.entries(result.categories)
      .filter(([, flagged]) => flagged)
      .map(([category]) => category);

    return { kind: item.kind, label: item.label, flagged: result.flagged, categories };
  });

  return { flagged: details.some((d) => d.flagged), details };
}
