import { cleanHtml, countUnclear } from "./html.js";
import { encodePhoto, type Photo } from "./image.js";
import { callProvider, DEFAULT_MODELS, type Provider, type ProviderClients, type Usage } from "./providers.js";

export { openPrint } from "./print.js";
export {
  type AnthropicClient,
  DEFAULT_MODELS,
  type GoogleClient,
  type OpenAIClient,
  type Provider,
  type ProviderClients,
  RebuildError,
  type Usage,
} from "./providers.js";
export type { Photo } from "./image.js";

type OptionsFor<P extends Provider> = {
  provider: P;
  /**
   * API key for that provider. Ignored when `client` is given. In Node it can be left out
   * and the SDK reads its usual environment variable.
   */
  apiKey?: string;
  /**
   * An SDK client you built yourself (`new Anthropic()`, `new OpenAI()`, `new GoogleGenAI()`),
   * for a proxy `baseURL`, a custom `fetch` and so on. Its options are used as they are.
   */
  client?: ProviderClients[P];
  /** Defaults to DEFAULT_MODELS[provider]. */
  model?: string;
  signal?: AbortSignal;
};

export type RebuildOptions = { [P in Provider]: OptionsFor<P> }[Provider];

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
  const { text, usage, model } = await callProvider(options.provider, image, {
    model: options.model ?? DEFAULT_MODELS[options.provider],
    apiKey: options.apiKey,
    client: options.client,
    signal: options.signal,
  });
  const html = cleanHtml(text);
  return { html, unclear: countUnclear(html), usage, model };
}
