import type { LanguageModel } from 'ai';
import { cleanHtml, countUnclear } from './html.js';
import { encodePhoto, type Photo } from './image.js';
import {
  callModel,
  DEFAULT_MODELS,
  type ModelIds,
  type Provider,
  providerModel,
  type Usage,
} from './providers.js';

export { openPrint } from './print.js';
export {
  DEFAULT_MODELS,
  type ModelIds,
  type Provider,
  RebuildError,
  type Usage,
} from './providers.js';
export type { Photo } from './image.js';

type ProviderOptions<P extends Provider> = {
  provider: P;
  /** API key for that provider. In Node it can be left out and the provider reads its usual environment variable. */
  apiKey?: string;
  /** Defaults to DEFAULT_MODELS[provider]. Suggestions come from the provider package. */
  model?: ModelIds[P];
  signal?: AbortSignal;
};

type ModelOptions = {
  /**
   * An AI SDK model you built yourself, e.g. `createOpenAI({ baseURL })("gpt-6.2-sol")`, a
   * Bedrock or Azure model, or a gateway ID string such as `"openai/gpt-6.2-sol"`.
   */
  model: LanguageModel;
  provider?: never;
  apiKey?: never;
  signal?: AbortSignal;
};

export type RebuildOptions = { [P in Provider]: ProviderOptions<P> }[Provider] | ModelOptions;

export type RebuildResult = {
  /** A complete HTML document, sized for A4. */
  html: string;
  /** How many spots the model marked as hard to read (`<mark class="unclear">`). */
  unclear: number;
  usage: Usage;
  /** The model that wrote the page. Can differ from the one requested when a provider falls back. */
  model: string;
};

/** Reads a photo of a paper document and rebuilds it as printable HTML. */
export async function rebuild(photo: Photo, options: RebuildOptions): Promise<RebuildResult> {
  const image = await encodePhoto(photo);
  const model =
    options.provider === undefined
      ? options.model
      : await providerModel(
          options.provider,
          options.model ?? DEFAULT_MODELS[options.provider],
          options.apiKey,
        );
  const { text, usage, model: wrote } = await callModel(model, image, options.signal);
  const html = cleanHtml(text);
  return { html, unclear: countUnclear(html), usage, model: wrote };
}
