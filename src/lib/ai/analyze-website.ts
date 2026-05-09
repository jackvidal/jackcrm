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
    max_tokens: 2048,
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

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === ANALYSIS_TOOL_NAME,
  );
  if (!toolUse) {
    throw new Error("Model did not return structured analysis");
  }

  const input = toolUse.input as {
    summary: string;
    issues: string[];
    opportunities: string[];
    recommendedServices: string[];
    recommendedNextSteps: string[];
  };

  return {
    summary: input.summary,
    issues: input.issues,
    opportunities: input.opportunities,
    recommendedServices: input.recommendedServices,
    recommendedNextSteps: input.recommendedNextSteps,
    modelUsed: DEFAULT_MODEL,
    raw: response,
  };
}
