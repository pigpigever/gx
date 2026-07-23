import { loadConfig } from "./config-store.js";
import type { AiConfig } from "../types.js";

// ── AI Provider presets ──

export interface AiProvider {
  name: string;
  value: string;
  endpoint: string;
  model: string;
  free?: boolean;
}

export const AI_PROVIDERS: AiProvider[] = [
  { name: "OpenAI", value: "openai", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  { name: "DeepSeek", value: "deepseek", endpoint: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat" },
  { name: "通义千问 (DashScope)", value: "dashscope", endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", model: "qwen-plus" },
  { name: "Moonshot (Kimi)", value: "moonshot", endpoint: "https://api.moonshot.cn/v1/chat/completions", model: "moonshot-v1-8k" },
  { name: "OpenCode (免费)", value: "opencode", endpoint: "https://opencode.ai/zen/v1/chat/completions", model: "big-pickle", free: true },
  { name: "自定义 (OpenAI 兼容)", value: "custom", endpoint: "", model: "" },
];

// ── Config reading ──

function isFreeProvider(value?: string): boolean {
  return AI_PROVIDERS.some((p) => p.value === value && p.free);
}

export function getAiConfig(): AiConfig | null {
  const config = loadConfig();
  // 优先读顶层 ai，fallback 到 commit.ai
  if (config.ai) {
    if (config.ai.apiKey || isFreeProvider(config.ai.provider)) {
      return config.ai;
    }
  }
  if (config.commit?.ai) {
    if (config.commit.ai.apiKey || isFreeProvider(config.commit.ai.provider)) {
      return {
        provider: config.commit.ai.provider,
        model: config.commit.ai.model || "gpt-4o-mini",
        endpoint: config.commit.ai.endpoint || "https://api.openai.com/v1/chat/completions",
        apiKey: config.commit.ai.apiKey || "",
      };
    }
  }
  // 检查环境变量
  const envKey = process.env.GX_AI_KEY;
  if (envKey) {
    return {
      model: "gpt-4o-mini",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: envKey,
    };
  }
  return null;
}

// ── API call ──

export async function callAiApi(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from AI");

  return text;
}

// ── Connection test ──

export async function testAiConnection(
  endpoint: string,
  apiKey: string,
  model: string
): Promise<{ success: boolean; message: string }> {
  try {
    const reply = await callAiApi(endpoint, apiKey, model, "Say 'Hello' in one word.");
    return { success: true, message: reply };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
