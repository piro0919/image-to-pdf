// 提供元ごとの呼び出し。どれも「画像を渡し、HTML の文字列とトークン数を返す」だけにそろえる
// SDK は使う提供元の分だけ読み込む（ブラウザで3社分を抱えないため）
import type { EncodedImage } from "./image.js";
import { SYSTEM_PROMPT, USER_PROMPT } from "./prompt.js";

export type Provider = "anthropic" | "openai" | "google";

// 既定は各社の上位寄りのモデル。安いモデルは印を付けずに読み違えたため（2026-11-20 の試作）
export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-6.2-sol",
  google: "gemini-3.8-flash",
};

export type Usage = { inputTokens: number; outputTokens: number };
/** `model` is the model that actually wrote the page, which can differ from the one requested. */
export type ProviderResult = { text: string; usage: Usage; model: string };

// 利用者が組み立てた SDK の客体。中継・Azure・環境変数などの設定は利用者の側で済ませる
// 公開の型に SDK の型を出さないため、使うメソッドがあることだけを形で見る
// （SDK を入れていない提供元の型が、利用者の型検査で見つからなくなるのを避ける）
type Method = (...args: never[]) => unknown;
export type AnthropicClient = { beta: { messages: { stream: Method } } };
export type OpenAIClient = { responses: { create: Method } };
export type GoogleClient = { models: { generateContent: Method } };
export type ProviderClients = { anthropic: AnthropicClient; openai: OpenAIClient; google: GoogleClient };

type CallOptions = { model: string; apiKey?: string; client?: unknown; signal?: AbortSignal };

// SDK は任意の peerDependencies。入っていないときは何を入れればよいかを言う
async function load<T>(name: string, provider: Provider, loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (cause) {
    throw new Error(`Install "${name}" to use the ${provider} provider, or pass your own client.`, { cause });
  }
}

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

async function anthropicClient({ apiKey, client }: CallOptions): Promise<import("@anthropic-ai/sdk").default> {
  if (client) return client as import("@anthropic-ai/sdk").default;
  const { default: Anthropic } = await load("@anthropic-ai/sdk", "anthropic", () => import("@anthropic-ai/sdk"));
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

async function callAnthropic(image: EncodedImage, options: CallOptions): Promise<ProviderResult> {
  const { model, signal } = options;
  const client = await anthropicClient(options);
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
  // 途中で切れたものだけを失敗にする。end_turn 以外にも正常に終わる理由があるため
  const stop = String(message.stop_reason);
  if (["max_tokens", "refusal", "model_context_window_exceeded"].includes(stop)) {
    throw new RebuildError(`Claude stopped early: ${stop}`, "anthropic", stop);
  }
  // 別のモデルへ回ったときは、最後に引き継いだモデルが書いている
  const handedTo = message.content.flatMap((b) => (b.type === "fallback" ? [b.to.model] : [])).at(-1);
  return {
    text: message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(""),
    usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    model: handedTo ?? message.model,
  };
}

async function openAIClient({ apiKey, client }: CallOptions): Promise<import("openai").default> {
  if (client) return client as import("openai").default;
  const { default: OpenAI } = await load("openai", "openai", () => import("openai"));
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

async function callOpenAI(image: EncodedImage, options: CallOptions): Promise<ProviderResult> {
  const { model, signal } = options;
  const client = await openAIClient(options);
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
    model: response.model,
  };
}

async function googleClient({ apiKey, client }: CallOptions): Promise<import("@google/genai").GoogleGenAI> {
  if (client) return client as import("@google/genai").GoogleGenAI;
  const { GoogleGenAI } = await load("@google/genai", "google", () => import("@google/genai"));
  // キーを省くと SDK が環境変数 GEMINI_API_KEY / GOOGLE_API_KEY を読む
  return new GoogleGenAI(apiKey ? { apiKey } : {});
}

async function callGoogle(image: EncodedImage, options: CallOptions): Promise<ProviderResult> {
  const { model, signal } = options;
  const client = await googleClient(options);
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
    model: response.modelVersion ?? model,
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
