import Anthropic from "@anthropic-ai/sdk";
import {
  CALL_ANALYSIS_SYSTEM_PROMPT,
  CALL_ANALYSIS_TOOL_DEFINITION,
  CALL_ANALYSIS_TOOL_NAME,
} from "./call-prompts";

export type CallSentimentValue = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface CallAnalysisResult {
  summary: string;
  keyTopics: string[];
  sentiment: CallSentimentValue;
  sentimentReason: string;
  prospectCommitments: string[];
  myCommitments: string[];
  recommendedNextSteps: string[];
  redFlags: string[];
  modelUsed: string;
  raw: unknown;
}

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function analyzeCall(transcript: string): Promise<CallAnalysisResult> {
  if (!transcript.trim()) {
    throw new Error("אין תמלול לניתוח");
  }

  const client = getClient();

  // Note: no web_fetch needed here — we already have the transcript.
  // tool_choice CAN force the analysis tool directly (unlike website analysis).
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192, // Hebrew tokenizes hungrily; plenty of headroom
    system: [
      {
        type: "text",
        text: CALL_ANALYSIS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [CALL_ANALYSIS_TOOL_DEFINITION],
    tool_choice: { type: "tool", name: CALL_ANALYSIS_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `נתח את השיחה הבאה. תמלול:\n\n${transcript}`,
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("הניתוח חרג ממגבלת האורך. נסו שוב או צמצמו את התמלול.");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === CALL_ANALYSIS_TOOL_NAME,
  );
  if (!toolUse) {
    throw new Error("המודל לא החזיר ניתוח מובנה");
  }

  const input = toolUse.input as Partial<CallAnalysisResult>;

  // Be lenient: save whatever Claude returned. Empty/missing fields render
  // as empty sections in the UI. This handles short/sparse transcripts
  // gracefully instead of failing the whole analysis.
  return {
    summary:
      input.summary ?? "התמלול קצר מדי או לא ברור לניתוח מלא.",
    keyTopics: Array.isArray(input.keyTopics) ? input.keyTopics : [],
    sentiment: (input.sentiment ?? "NEUTRAL") as CallSentimentValue,
    sentimentReason: input.sentimentReason ?? "",
    prospectCommitments: Array.isArray(input.prospectCommitments)
      ? input.prospectCommitments
      : [],
    myCommitments: Array.isArray(input.myCommitments)
      ? input.myCommitments
      : [],
    recommendedNextSteps: Array.isArray(input.recommendedNextSteps)
      ? input.recommendedNextSteps
      : [],
    redFlags: Array.isArray(input.redFlags) ? input.redFlags : [],
    modelUsed: DEFAULT_MODEL,
    raw: response,
  };
}
