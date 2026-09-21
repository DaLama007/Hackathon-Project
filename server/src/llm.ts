export type LlmProvider = "openrouter" | "openai";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Prefer OpenRouter (`AI-KEY` / `OPENROUTER_API_KEY`), else OpenAI. */
export function resolveLlmConfig(): LlmConfig | null {
  const openRouterKey = firstEnv("OPENROUTER_API_KEY", "AI-KEY", "AI_KEY");
  if (openRouterKey) {
    return {
      provider: "openrouter",
      apiKey: openRouterKey,
      baseUrl: firstEnv("OPENROUTER_BASE_URL") || "https://openrouter.ai/api/v1",
      model:
        firstEnv("OPENROUTER_MODEL", "AI_MODEL", "OPENAI_VISION_MODEL") ||
        "openai/gpt-4o-mini",
    };
  }

  const openAiKey = firstEnv("OPENAI_API_KEY");
  if (openAiKey) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      baseUrl: firstEnv("OPENAI_BASE_URL") || "https://api.openai.com/v1",
      model: firstEnv("OPENAI_VISION_MODEL", "AI_MODEL") || "gpt-4o-mini",
    };
  }

  return null;
}

export async function chatCompletions(options: {
  messages: unknown[];
  temperature?: number;
  json?: boolean;
}): Promise<string> {
  const config = resolveLlmConfig();
  if (!config) throw new Error("No AI API key configured");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  if (config.provider === "openrouter") {
    // OpenRouter optional ranking headers — safe public app name only
    headers["HTTP-Referer"] = firstEnv("OPENROUTER_SITE_URL") || "http://localhost:5173";
    headers["X-Title"] = firstEnv("OPENROUTER_APP_NAME") || "PlateWise";
  }

  const body: Record<string, unknown> = {
    model: config.model,
    temperature: options.temperature ?? 0.2,
    messages: options.messages,
  };
  if (options.json) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${config.provider} HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error(`${config.provider} returned empty content`);
  return content;
}
