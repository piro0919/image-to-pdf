// 提供元ごとの呼び出し。どれも「画像を渡し、HTML の文字列とトークン数を返す」だけにそろえる
// SDK は使う提供元の分だけ読み込む（ブラウザで3社分を抱えないため）
import type { EncodedImage } from "./image.ts";
import { SYSTEM_PROMPT, USER_PROMPT } from "./prompt.ts";

export type Provider = "anthropic" | "openai" | "google";

// 既定は各社の上位寄りのモデル。安いモデルは印を付けずに読み違えたため（2026-11-20 の試作）
export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-6.2-sol",
  google: "gemini-3.8-flash",
};

export type Usage = { inputTokens: number; outputTokens: number };
export type ProviderResult = { text: string; usage: Usage };

type CallOptions = { model: string; apiKey: string; signal?: AbortSignal };

/** The model stopped without finishing the page (refused, ran out of tokens, blocked). */
export class RebuildError extends Error {
  readonly provider: Provider;
  readonly reason: string;
  constructor(message: string, provider: Provider, reason: string) {
    super(message);
    this.name = "RebuildError";
    this.provider = provider;
    this.reason = reason;
  }
}

async function callAnthropic(image: EncodedImage, { model, apiKey, signal }: CallOptions): Promise<ProviderResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const content = [
    { type: "image" as const, source: { type: "base64" as const, media_type: image.mediaType, data: image.data } },
    { type: "text" as const, text: USER_PROMPT },
  ];
  // 安全の判定で断られたときに、サーバー側で別のモデルへ回す。Haiku には無い
  const fallbacks = model.startsWith("claude-haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  const message = await client.beta.messages
    .stream(
      { model, max_tokens: 64000, system: SYSTEM_PROMPT, messages: [{ role: "user", content }], ...fallbacks },
      { signal },
    )
    .finalMessage();
  if (message.stop_reason !== "end_turn") {
    throw new RebuildError(`Claude stopped early: ${message.stop_reason}`, "anthropic", String(message.stop_reason));
  }
  return {
    text: message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(""),
    usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
  };
}

async function callOpenAI(image: EncodedImage, { model, apiKey, signal }: CallOptions): Promise<ProviderResult> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.responses.create(
    {
      model,
      instructions: SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: [
            { type: "input_image", image_url: `data:${image.mediaType};base64,${image.data}`, detail: "high" },
            { type: "input_text", text: USER_PROMPT },
          ],
        },
      ],
    },
    { signal },
  );
  if (response.status !== "completed") {
    const reason = response.incomplete_details?.reason ?? response.status ?? "unknown";
    throw new RebuildError(`OpenAI stopped early: ${reason}`, "openai", reason);
  }
  return {
    text: response.output_text,
    // output_tokens は推論のトークンを含む
    usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
  };
}

async function callGoogle(image: EncodedImage, { model, apiKey, signal }: CallOptions): Promise<ProviderResult> {
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: [{ inlineData: { mimeType: image.mediaType, data: image.data } }, { text: USER_PROMPT }],
    config: { systemInstruction: SYSTEM_PROMPT, abortSignal: signal },
  });
  const finish = response.candidates?.[0]?.finishReason;
  if (finish !== "STOP") {
    const reason = String(finish ?? response.promptFeedback?.blockReason ?? "unknown");
    throw new RebuildError(`Gemini stopped early: ${reason}`, "google", reason);
  }
  const usage = response.usageMetadata;
  return {
    text: response.text ?? "",
    // 思考のトークンは candidates と別に数えられ、どちらも出力として課金される
    usage: {
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
    },
  };
}

const CALLERS: Record<Provider, (image: EncodedImage, options: CallOptions) => Promise<ProviderResult>> = {
  anthropic: callAnthropic,
  openai: callOpenAI,
  google: callGoogle,
};

export function callProvider(provider: Provider, image: EncodedImage, options: CallOptions): Promise<ProviderResult> {
  const caller = CALLERS[provider];
  if (!caller) throw new Error(`Unknown provider: ${provider}`);
  return caller(image, options);
}
