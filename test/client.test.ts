import { readFileSync } from "node:fs";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { RebuildError, rebuild } from "../src/index.js";

const png = readFileSync(new URL("../spike/samples/ja-referral.png", import.meta.url));
const PAGE = "<!doctype html><html><body><p>ok</p></body></html>";

type Generated = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

function answer(overrides: Partial<Generated> = {}): Generated {
  return {
    content: [{ type: "text", text: PAGE }],
    finishReason: { unified: "stop", raw: "end_turn" },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 20, text: 15, reasoning: 5 },
    },
    warnings: [],
    ...overrides,
  };
}

describe("rebuild with an AI SDK model", () => {
  it("sends the photo to the given model and reports what came back", async () => {
    const model = new MockLanguageModelV4({ provider: "proxy.responses", modelId: "gpt-6.2-sol", doGenerate: answer() });

    const result = await rebuild(png, { model });

    expect(model.doGenerateCalls).toHaveLength(1);
    expect(result.html).toContain("<p>ok</p>");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(result.model).toBe("gpt-6.2-sol");
  });

  it("asks OpenAI to read the photo at high detail", async () => {
    const model = new MockLanguageModelV4({ doGenerate: answer() });

    await rebuild(png, { model });

    const user = model.doGenerateCalls[0]?.prompt.find((m) => m.role === "user");
    const file = Array.isArray(user?.content) ? user.content.find((p) => p.type === "file") : undefined;
    expect(file?.providerOptions).toEqual({ openai: { imageDetail: "high" } });
  });

  it("turns on Anthropic's server-side fallback, except for Haiku", async () => {
    const sonnet = new MockLanguageModelV4({ modelId: "claude-sonnet-5-5", doGenerate: answer() });
    const haiku = new MockLanguageModelV4({ modelId: "claude-haiku-5-5", doGenerate: answer() });

    await rebuild(png, { model: sonnet });
    await rebuild(png, { model: haiku });

    expect(sonnet.doGenerateCalls[0]?.providerOptions).toEqual({ anthropic: { fallbacks: "default" } });
    expect(haiku.doGenerateCalls[0]?.providerOptions?.anthropic).toBeUndefined();
  });

  it("names the model a fallback handed the page to", async () => {
    const model = new MockLanguageModelV4({
      modelId: "claude-sonnet-5-5",
      doGenerate: answer({
        content: [
          {
            type: "custom",
            kind: "anthropic.fallback",
            providerMetadata: { anthropic: { type: "fallback", from: { model: "claude-sonnet-5-5" }, to: { model: "claude-opus-5-5" } } },
          },
          { type: "text", text: PAGE },
        ],
      }),
    });

    const result = await rebuild(png, { model });

    expect(result.model).toBe("claude-opus-5-5");
  });

  it("throws RebuildError when the page was cut off", async () => {
    const model = new MockLanguageModelV4({ doGenerate: answer({ finishReason: { unified: "length", raw: "max_tokens" } }) });

    await expect(rebuild(png, { model })).rejects.toBeInstanceOf(RebuildError);
    await expect(rebuild(png, { model })).rejects.toMatchObject({ reason: "max_tokens" });
  });
});
