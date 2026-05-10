import Anthropic from "@anthropic-ai/sdk";
import { fetchPageContent } from "./fetch-page";
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
  const page = await fetchPageContent(url);

  const userPrompt = [
    `URL: ${page.url}`,
    page.title ? `Title: ${page.title}` : null,
    page.description ? `Meta description: ${page.description}` : null,
    "",
    "תוכן הדף:",
    page.text || "(תוכן ריק)",
  ]
    .filter(Boolean)
    .join("\n");

  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    // Hebrew tokenizes more aggressively than English; 8192 leaves
    // plenty of headroom for 5 well-developed sections.
    max_tokens: 8192,
    // Cache the system prompt so subsequent analyses are cheaper.
    system: [
      {
        type: "text",
        text: ANALYSIS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [ANALYSIS_TOOL_DEFINITION],
    tool_choice: { type: "tool", name: ANALYSIS_TOOL_NAME },
    messages: [{ role: "user", content: userPrompt }],
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

  // Defensive: every required field must be non-empty.
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
