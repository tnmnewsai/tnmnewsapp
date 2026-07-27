import fs from "node:fs";
import OpenAI from "openai";

export interface SynthesizeNarrationInput {
  text: string;
  outputPath: string;
  voice?: string;
}

/** Same OpenAI key/account as @svt/transcription's Whisper adapter — one provider credential covers both. */
export async function synthesizeNarration(apiKey: string, input: SynthesizeNarrationInput): Promise<void> {
  const client = new OpenAI({ apiKey });
  const response = await client.audio.speech.create({
    model: "tts-1",
    voice: (input.voice ?? "alloy") as OpenAI.Audio.Speech.SpeechCreateParams["voice"],
    input: input.text,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(input.outputPath, buffer);
}
