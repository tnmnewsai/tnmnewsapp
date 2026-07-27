import Anthropic from "@anthropic-ai/sdk";

const TOOL_NAME = "propose_post_copy";

/**
 * The plan's "one canonical clip + core message, identical across every
 * connected platform" means the copy has to fit the tightest constraint of
 * any target platform — X's ~280 characters — not a per-platform limit.
 * Per-platform mechanical packaging (truncation/hashtag placement/title
 * derivation) happens later, in the publishing adapters (Milestone 8+).
 */
const TIGHTEST_PLATFORM_CHAR_LIMIT = 280;

export interface GeneratePostCopyInput {
  clipTitle: string;
  transcriptExcerpt: string;
  targetCount: number;
}

export interface PostCopyVariantProposal {
  text: string;
  hashtags: string[];
}

export async function generatePostCopyVariants(
  apiKey: string,
  input: GeneratePostCopyInput,
): Promise<PostCopyVariantProposal[]> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    tools: [
      {
        name: TOOL_NAME,
        description: "Propose canonical social post copy variants for a short-form video clip.",
        input_schema: {
          type: "object",
          properties: {
            variants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    description:
                      `The post caption/body text, without hashtags appended. Must comfortably fit ` +
                      `within ${TIGHTEST_PLATFORM_CHAR_LIMIT} characters, since it's posted identically ` +
                      `everywhere including the tightest platform.`,
                  },
                  hashtags: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-6 relevant hashtags, no leading # character",
                  },
                },
                required: ["text", "hashtags"],
              },
            },
          },
          required: ["variants"],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content:
          `Here is a short-form video clip titled "${input.clipTitle}".\n\n` +
          `Transcript excerpt:\n${input.transcriptExcerpt}\n\n` +
          `Draft exactly ${input.targetCount} distinct canonical social post copy variants for this clip. ` +
          `The same copy is posted identically across every connected platform (YouTube, Instagram, ` +
          `TikTok, X), so each variant must work everywhere and fit within ${TIGHTEST_PLATFORM_CHAR_LIMIT} ` +
          `characters, leaving room for hashtags. Give each variant a different angle (hook-first, ` +
          `question, bold claim, etc). Don't include hashtags in the text itself — return them separately.`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) throw new Error("Claude did not return a tool_use block.");

  const parsed = toolUse.input as { variants: PostCopyVariantProposal[] };
  return parsed.variants.slice(0, input.targetCount);
}
