import { cleanHtml, countUnclear } from "./html.ts";
import { encodePhoto, type Photo } from "./image.ts";
import { callProvider, DEFAULT_MODELS, type Provider, type Usage } from "./providers.ts";

export { openPrint } from "./print.ts";
export { DEFAULT_MODELS, RebuildError, type Provider, type Usage } from "./providers.ts";
export type { Photo } from "./image.ts";

export type RebuildOptions = {
  provider: Provider;
  /** The caller's own API key for that provider. */
  apiKey: string;
  /** Defaults to DEFAULT_MODELS[provider]. */
  model?: string;
  signal?: AbortSignal;
};

export type RebuildResult = {
  /** A complete HTML document, sized for A4. */
  html: string;
  /** How many spots the model marked as hard to read (`<mark class="unclear">`). */
  unclear: number;
  usage: Usage;
  model: string;
};

/** Reads a photo of a paper document and rebuilds it as printable HTML. */
export async function rebuild(photo: Photo, options: RebuildOptions): Promise<RebuildResult> {
  const model = options.model ?? DEFAULT_MODELS[options.provider];
  const image = await encodePhoto(photo);
  const { text, usage } = await callProvider(options.provider, image, {
    model,
    apiKey: options.apiKey,
    signal: options.signal,
  });
  const html = cleanHtml(text);
  return { html, unclear: countUnclear(html), usage, model };
}
