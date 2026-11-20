// 提供元の呼び出しは Vercel の AI SDK に任せる。どれも「画像を渡し、HTML の文字列とトークン数を返す」だけ
// 提供元のパッケージは使う分だけ読み込む（ブラウザで3社分を抱えないため）
// モデル名の型は各提供元のパッケージから取る。パッケージの更新で新しいモデル名が補完に出る
import type { createAnthropic } from '@ai-sdk/anthropic';
import type { createGoogle } from '@ai-sdk/google';
import type { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { EncodedImage } from './image.js';
import { SYSTEM_PROMPT, USER_PROMPT } from './prompt.js';

export type Provider = 'anthropic' | 'openai' | 'google';

/** Model IDs each provider package knows about, plus any other string. */
export type ModelIds = {
  anthropic: Parameters<ReturnType<typeof createAnthropic>['languageModel']>[0];
  openai: Parameters<ReturnType<typeof createOpenAI>['responses']>[0];
  google: Parameters<ReturnType<typeof createGoogle>['languageModel']>[0];
};

// 既定は各社の上位寄りのモデル。安いモデルは印を付けずに読み違えたため（2026-11-20 の試作）
export const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-6.2-sol',
  google: 'gemini-3.8-flash',
} as const satisfies { [P in Provider]: ModelIds[P] };

export type Usage = { inputTokens: number; outputTokens: number };
/** `model` is the model that actually wrote the page, which can differ from the one requested. */
export type ProviderResult = { text: string; usage: Usage; model: string };

/** The model stopped without finishing the page (refused, ran out of tokens, blocked). */
export class RebuildError extends Error {
  /** The provider name the AI SDK reports, e.g. "anthropic.messages". */
  readonly provider: string;
  readonly reason: string;
  constructor(message: string, provider: string, reason: string) {
    super(message);
    this.name = 'RebuildError';
    this.provider = provider;
    this.reason = reason;
  }
}

/** Builds the AI SDK model for a provider name, model ID and key. */
export async function providerModel(
  provider: Provider,
  modelId: string,
  apiKey?: string,
): Promise<LanguageModel> {
  switch (provider) {
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      // ブラウザから直接呼ぶには、この見出しで明示的に許す必要がある
      return createAnthropic({
        apiKey,
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      })(modelId);
    }
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey }).responses(modelId);
    }
    case 'google': {
      const { createGoogle } = await import('@ai-sdk/google');
      return createGoogle({ apiKey })(modelId);
    }
    default:
      throw new Error(`Unknown provider: ${String(provider)}`);
  }
}

function modelIdOf(model: LanguageModel): string {
  return typeof model === 'string' ? model : model.modelId;
}

// Anthropic の自社 API に直接つなぐモデルか。Bedrock・Vertex・gateway 経由のものは含めない
function isAnthropicApi(model: LanguageModel): boolean {
  return typeof model !== 'string' && model.provider.startsWith('anthropic.');
}

// 安全の判定で断られたときに、Anthropic のサーバー側で別のモデルへ回す。Haiku には無い。
// Bedrock などがこの設定を受け付けるかは確かめていないので、自社 API のときだけ付ける
function fallbackOptions(
  model: LanguageModel,
): { anthropic: { fallbacks: 'default' } } | undefined {
  return isAnthropicApi(model) && !modelIdOf(model).includes('claude-haiku')
    ? { anthropic: { fallbacks: 'default' } }
    : undefined;
}

// @ai-sdk/anthropic は、知らないモデル名だと出力の上限を 4096 にする（4.0.106 の実装）。
// 表の多いページは収まらないので、AI SDK に載せ替える前と同じ値を渡す。知っているモデルでは、その上限まで下げられる
const ANTHROPIC_MAX_OUTPUT_TOKENS = 64_000;

// 書き終えた（stop）もの以外は失敗にする。'other' は Gemini の OTHER や、AI SDK が知らない止まり方
const FAILED = new Set(['length', 'content-filter', 'error', 'other']);

export async function callModel(
  model: LanguageModel,
  image: EncodedImage,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const { generateText } = await import('ai');
  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: image.data,
            mediaType: image.mediaType,
            // OpenAI は既定だと画像を縮めて読む。細かい手書きのため高い解像度で渡す
            providerOptions: { openai: { imageDetail: 'high' } },
          },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
    providerOptions: fallbackOptions(model),
    maxOutputTokens: isAnthropicApi(model) ? ANTHROPIC_MAX_OUTPUT_TOKENS : undefined,
    abortSignal: signal,
  });

  const provider = typeof model === 'string' ? 'gateway' : model.provider;
  if (FAILED.has(result.finishReason)) {
    const reason = result.rawFinishReason ?? result.finishReason;
    throw new RebuildError(`The model stopped early: ${reason}`, provider, reason);
  }
  if (!result.text.trim()) {
    throw new RebuildError('The model returned no page.', provider, 'empty');
  }

  // Anthropic で別のモデルへ回ったときは、最後に引き継いだモデルが書いている
  const handedTo = result.content
    .flatMap((part) => {
      if (part.type !== 'custom' || part.kind !== 'anthropic.fallback') return [];
      const to = (part.providerMetadata?.anthropic as { to?: { model?: string } } | undefined)?.to
        ?.model;
      return to ? [to] : [];
    })
    .at(-1);

  return {
    text: result.text,
    // 出力のトークンは推論・思考の分を含む。どれも出力として課金される
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    },
    model: handedTo ?? result.response.modelId ?? modelIdOf(model),
  };
}
