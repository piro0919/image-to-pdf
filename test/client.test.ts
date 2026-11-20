import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { type OpenAIClient, rebuild } from "../src/index.js";

const png = readFileSync(new URL("../spike/samples/ja-referral.png", import.meta.url));
const PAGE = "<!doctype html><html><body><p>ok</p></body></html>";

describe("rebuild with a caller's own client", () => {
  it("uses the given OpenAI client and its options, not a new one built from apiKey", async () => {
    const create = vi.fn(async () => ({
      status: "completed",
      output_text: PAGE,
      usage: { input_tokens: 10, output_tokens: 20 },
      model: "proxied-model",
    }));
    const client: OpenAIClient = { responses: { create } };

    const result = await rebuild(png, { provider: "openai", client, apiKey: "ignored" });

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.model).toBe("proxied-model");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(result.html).toContain("<p>ok</p>");
  });

  it("uses the given Anthropic client", async () => {
    const stream = vi.fn(() => ({
      finalMessage: async () => ({
        stop_reason: "end_turn",
        content: [{ type: "text", text: PAGE }],
        usage: { input_tokens: 1, output_tokens: 2 },
        model: "claude-via-proxy",
      }),
    }));

    const result = await rebuild(png, { provider: "anthropic", client: { beta: { messages: { stream } } } });

    expect(stream).toHaveBeenCalledTimes(1);
    expect(result.model).toBe("claude-via-proxy");
  });

  it("uses the given Gemini client", async () => {
    const generateContent = vi.fn(async () => ({
      candidates: [{ finishReason: "STOP" }],
      text: PAGE,
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4, thoughtsTokenCount: 5 },
      modelVersion: "gemini-via-proxy",
    }));

    const result = await rebuild(png, { provider: "google", client: { models: { generateContent } } });

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 9 });
  });
});
