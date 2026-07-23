import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mocks (use vi.hoisted so they survive vi.mock hoisting) ──

const { mockLoadConfig } = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(),
}));

vi.mock("../src/lib/config-store.js", () => ({
  loadConfig: () => mockLoadConfig(),
}));

const { getAiConfig, callAiApi, testAiConnection, AI_PROVIDERS } = await import("../src/lib/ai.js");

// ── getAiConfig ──

describe("getAiConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockLoadConfig.mockReset();
  });

  it("returns top-level ai config when apiKey is present", () => {
    mockLoadConfig.mockReturnValue({
      ai: { provider: "openai", model: "gpt-4o", endpoint: "https://api.openai.com/v1/chat/completions", apiKey: "sk-test" },
      repos: {},
    });
    const config = getAiConfig();
    expect(config).toEqual({
      provider: "openai",
      model: "gpt-4o",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
    });
  });

  it("returns top-level ai config for free provider without apiKey", () => {
    mockLoadConfig.mockReturnValue({
      ai: { provider: "opencode", model: "big-pickle", endpoint: "https://opencode.ai/zen/v1/chat/completions", apiKey: "" },
      repos: {},
    });
    const config = getAiConfig();
    expect(config).not.toBeNull();
    expect(config!.provider).toBe("opencode");
  });

  it("falls back to commit.ai when top-level ai has no apiKey", () => {
    mockLoadConfig.mockReturnValue({
      ai: { provider: "deepseek", apiKey: "" },
      commit: {
        ai: { provider: "openai", model: "gpt-4o-mini", endpoint: "https://api.openai.com/v1/chat/completions", apiKey: "sk-commit" },
      },
      repos: {},
    });
    const config = getAiConfig();
    expect(config).toEqual({
      provider: "openai",
      model: "gpt-4o-mini",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-commit",
    });
  });

  it("falls back to GX_AI_KEY env var", () => {
    mockLoadConfig.mockReturnValue({ repos: {} });
    vi.stubEnv("GX_AI_KEY", "sk-env-key");
    const config = getAiConfig();
    expect(config).toEqual({
      model: "gpt-4o-mini",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-env-key",
    });
  });

  it("returns null when no config exists", () => {
    mockLoadConfig.mockReturnValue({ repos: {} });
    expect(getAiConfig()).toBeNull();
  });

  it("returns null when top-level ai has no apiKey and non-free provider", () => {
    mockLoadConfig.mockReturnValue({
      ai: { provider: "deepseek", model: "deepseek-chat", endpoint: "https://api.deepseek.com", apiKey: "" },
      repos: {},
    });
    expect(getAiConfig()).toBeNull();
  });

  it("uses defaults for commit.ai missing fields", () => {
    mockLoadConfig.mockReturnValue({
      commit: { ai: { apiKey: "sk-min" } },
      repos: {},
    });
    const config = getAiConfig();
    expect(config).toEqual({
      provider: undefined,
      model: "gpt-4o-mini",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-min",
    });
  });
});

// ── AI_PROVIDERS ──

describe("AI_PROVIDERS", () => {
  it("contains expected providers", () => {
    const values = AI_PROVIDERS.map((p) => p.value);
    expect(values).toContain("openai");
    expect(values).toContain("deepseek");
    expect(values).toContain("opencode");
    expect(values).toContain("custom");
  });

  it("opencode provider is marked free", () => {
    const opencode = AI_PROVIDERS.find((p) => p.value === "opencode");
    expect(opencode?.free).toBe(true);
  });
});

// ── callAiApi ──

describe("callAiApi", () => {
  const endpoint = "https://api.openai.com/v1/chat/completions";
  const apiKey = "sk-test-key";
  const model = "gpt-4o-mini";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends correct request body and headers", async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "Hello world" } }] }),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

    const result = await callAiApi(endpoint, apiKey, model, "Say hello");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(endpoint);
    expect(init!.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual({
      model,
      messages: [{ role: "user", content: "Say hello" }],
      temperature: 0.3,
      max_tokens: 1500,
    });
    expect((init!.headers as Record<string, string>)["Authorization"]).toBe("Bearer sk-test-key");
    expect(result).toBe("Hello world");
  });

  it("omits Authorization header when apiKey is empty", async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "ok" } }] }),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

    await callAiApi(endpoint, "", model, "test");

    const headers = fetchSpy.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("throws on HTTP error", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

    await expect(callAiApi(endpoint, apiKey, model, "test")).rejects.toThrow("API 401: Unauthorized");
  });

  it("throws on empty response", async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

    await expect(callAiApi(endpoint, apiKey, model, "test")).rejects.toThrow("Empty response from AI");
  });

  it("throws on null content in response", async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: null } }] }),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

    await expect(callAiApi(endpoint, apiKey, model, "test")).rejects.toThrow("Empty response from AI");
  });
});

// ── testAiConnection ──

describe("testAiConnection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success on valid response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "Hello" } }] }),
    } as any);

    const result = await testAiConnection("https://api.test.com", "sk", "model");
    expect(result).toEqual({ success: true, message: "Hello" });
  });

  it("returns failure on error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await testAiConnection("https://api.test.com", "sk", "model");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Network error");
  });
});
