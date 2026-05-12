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

  // Defensive: required scalars must be present
  if (!input.summary || !input.sentiment || !input.sentimentReason) {
    throw new Error("הניתוח לא הושלם — שדות חסרים. נסו שוב.");
  }
  if (!Array.isArray(input.keyTopics) || !Array.isArray(input.recommendedNextSteps)) {
    throw new Error("הניתוח לא הושלם — שדות חסרים. נסו שוב.");
  }

  return {
    summary: input.summary,
    keyTopics: input.keyTopics,
    sentiment: input.sentiment as CallSentimentValue,
    sentimentReason: input.sentimentReason,
    prospectCommitments: input.prospectCommitments ?? [],
    myCommitments: input.myCommitments ?? [],
    recommendedNextSteps: input.recommendedNextSteps,
    redFlags: input.redFlags ?? [],
    modelUsed: DEFAULT_MODEL,
    raw: response,
  };
}
