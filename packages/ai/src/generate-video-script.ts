import Anthropic from "@anthropic-ai/sdk";
import type { VideoScriptSegmentProposal } from "./types";

const TOOL_NAME = "propose_script";

export interface GenerateVideoScriptInput {
  title: string;
  bodyText: string;
}

export async function generateVideoScript(
  apiKey: string,
  input: GenerateVideoScriptInput,
): Promise<VideoScriptSegmentProposal[]> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    tools: [
      {
        name: TOOL_NAME,
        description: "Break a blog article into narration segments for a short explainer video.",
        input_schema: {
          type: "object",
          properties: {
            segments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  narrationText: {
                    type: "string",
                    description: "One or two sentences of spoken narration for this segment",
                  },
                  visualPrompt: {
                    type: "string",
                    description:
                      "A short, concrete visual description (for an AI image generator) of what " +
                      "should be on screen during this segment",
                  },
                },
                required: ["narrationText", "visualPrompt"],
              },
            },
          },
          required: ["segments"],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content:
          `Turn this blog article into a narration script for a short explainer video, broken into ` +
          `segments of one or two sentences each (aim for a natural spoken pace, roughly 15-30 words ` +
          `per segment, 8-20 segments total depending on article length). Skip boilerplate like ` +
          `navigation text, tables, or reference lists — narrate the actual article content. For each ` +
          `segment also write a short, concrete visual prompt describing a simple, on-topic image an AI ` +
          `image generator could produce to illustrate it.\n\nTitle: ${input.title}\n\n${input.bodyText}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) throw new Error("Claude did not return a tool_use block.");

  const parsed = toolUse.input as { segments: VideoScriptSegmentProposal[] };
  if (parsed.segments.length === 0) {
    throw new Error("Claude returned zero script segments.");
  }
  return parsed.segments;
}
