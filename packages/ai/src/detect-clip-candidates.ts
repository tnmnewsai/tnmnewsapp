import Anthropic from "@anthropic-ai/sdk";
import { formatTranscript } from "./format-transcript";
import type { ClipCandidateProposal, TranscriptWordInput } from "./types";

const TOOL_NAME = "propose_clips";

export interface DetectClipCandidatesInput {
  words: TranscriptWordInput[];
  targetCount: number;
  durationMs?: number;
}

export async function detectClipCandidates(
  apiKey: string,
  input: DetectClipCandidatesInput,
): Promise<ClipCandidateProposal[]> {
  const client = new Anthropic({ apiKey });
  const transcript = formatTranscript(input.words);
  const durationNote = input.durationMs
    ? ` (total duration ${Math.round(input.durationMs / 1000)}s)`
    : "";

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Propose clip-worthy segments from a video transcript for short-form social media.",
        input_schema: {
          type: "object",
          properties: {
            candidates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  startMs: { type: "integer", description: "Start time in milliseconds" },
                  endMs: { type: "integer", description: "End time in milliseconds" },
                  title: { type: "string", description: "A punchy, short-form-style title" },
                  rationale: {
                    type: "string",
                    description: "One sentence on why this moment is clip-worthy",
                  },
                  confidence: {
                    type: "number",
                    description: "Self-rated confidence 0-1 that this will perform well as a short",
                  },
                },
                required: ["startMs", "endMs", "title", "rationale", "confidence"],
              },
            },
          },
          required: ["candidates"],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content:
          `Here is a timestamped transcript of a video${durationNote}. Each line starts with ` +
          `a [m:ss] timestamp marking where that line begins.\n\n${transcript}\n\n` +
          `Identify exactly ${input.targetCount} distinct, non-overlapping moments that would work ` +
          `well as standalone short-form video clips (a complete thought, a punchline, a surprising ` +
          `claim, a strong hook). Order them by how strong a candidate they are, best first. Clips ` +
          `should generally run 15-90 seconds. Use the line timestamps to set startMs/endMs.`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) throw new Error("Claude did not return a tool_use block.");

  const parsed = toolUse.input as { candidates: ClipCandidateProposal[] };
  return parsed.candidates.slice(0, input.targetCount);
}
