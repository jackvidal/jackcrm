import Anthropic from "@anthropic-ai/sdk";
import {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_TOOL_DEFINITION,
  ANALYSIS_TOOL_NAME,
} from "./prompts";

export interface AnalysisResult {
  summary: string;
  issues: string[];
  opportunities: string[];
  recommendedServices: string[];
  recommendedNextSteps: string[];
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

export async function analyzeWebsite(url: string): Promise<AnalysisResult> {
  // Validate URL upfront — Claude's web_fetch will also validate, but
  // failing early gives a cleaner error.
  try {
    new URL(url);
  } catch {
    throw new Error("כתובת אתר לא תקינה");
  }

  const client = getClient();

  // Server tool: Anthropic fetches the URL inline. No bot-blocking,
  // no User-Agent games, no cheerio parsing on our side.
  // Plus our custom tool that forces structured output.
  const tools: Anthropic.Messages.ToolUnion[] = [
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 2 },
    ANALYSIS_TOOL_DEFINITION,
  ];

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: ANALYSIS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools,
    // Force the final model output to be a call to submit_website_analysis.
    // web_fetch can still run as an intermediate step before this.
    tool_choice: { type: "tool", name: ANALYSIS_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `נתח את האתר הבא והחזר ניתוח מובנה דרך הכלי ${ANALYSIS_TOOL_NAME}: ${url}`,
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "הניתוח חרג ממגבלת האורך. נסו שוב או צמצמו את גודל הדף.",
    );
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === ANALYSIS_TOOL_NAME,
  );
  if (!toolUse) {
    throw new Error("המודל לא החזיר ניתוח מובנה");
  }

  const input = toolUse.input as Partial<{
    summary: string;
    issues: string[];
    opportunities: string[];
    recommendedServices: string[];
    recommendedNextSteps: string[];
  }>;

  const required = [
    "summary",
    "issues",
    "opportunities",
    "recommendedServices",
    "recommendedNextSteps",
  ] as const;
  const missing = required.filter((k) => {
    const v = input[k];
    return v === undefined || (Array.isArray(v) && v.length === 0);
  });
  if (missing.length > 0) {
    throw new Error(
      `הניתוח לא הושלם — חסרים שדות: ${missing.join(", ")}. נסו שוב.`,
    );
  }

  return {
    summary: input.summary!,
    issues: input.issues!,
    opportunities: input.opportunities!,
    recommendedServices: input.recommendedServices!,
    recommendedNextSteps: input.recommendedNextSteps!,
    modelUsed: DEFAULT_MODEL,
    raw: response,
  };
}
