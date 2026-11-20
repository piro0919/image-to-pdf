# @piro0919/image-to-pdf

Turn a photo of a paper document into a clean PDF. The page is read by an AI model and
typeset again as real text, with its tables, boxes and checkboxes laid out like the
original. It is not the photo pasted into a PDF.

Printed and handwritten text, in any language. Works with Claude, OpenAI or Gemini, using
your own API key.

> Status: early (0.x). The API may still change between minor versions.

## How it works

1. `rebuild()` sends the photo to the model you choose and gets back one HTML document
   sized for A4.
2. You turn that HTML into a PDF: in the browser through the print dialog
   ("Save as PDF"), or in Node with a local headless Chrome.

Anything the model cannot read with confidence is wrapped in `<mark class="unclear">` and
highlighted, and `unclear` tells you how many such spots there are. Models can still
misread text without marking it, so check the result against the photo, especially for
medical or legal documents.

## Install

```sh
npm install @piro0919/image-to-pdf
```

Requests go through the [AI SDK](https://ai-sdk.dev), which comes with the package. In the
browser only the provider you use is downloaded.

## Browser

```ts
import { openPrint, rebuild } from "@piro0919/image-to-pdf";

const { html, unclear, usage } = await rebuild(file, {
  provider: "openai",    // "anthropic" | "openai" | "google"
  apiKey,                // the user's own key
  model: "gpt-6.2-sol",  // optional; defaults to DEFAULT_MODELS[provider]
});

await openPrint(html); // opens the print dialog; choose "Save as PDF"
```

`model` suggests the model IDs the AI SDK provider package knows, and any other string is
accepted, so new models work before this package is updated.

The browser calls the provider directly, so the key never passes through a server of
yours. Anyone who can open the page's developer tools can see the key, so only use keys
that belong to the person using the page.

## Your own model

Instead of `provider` and `apiKey`, pass any AI SDK model as `model`. Use this to keep
your own key on your server behind a proxy:

```ts
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({ baseURL: "/api/openai", apiKey: "unused" }); // your proxy adds the key
const { html } = await rebuild(file, { model: openai.responses("gpt-6.2-sol") });
```

The same works for any provider the AI SDK supports, or a gateway ID string such as
`"openai/gpt-6.2-sol"`. Only Claude, OpenAI and Gemini have been tried with this package.

## Node

```ts
import { readFile } from "node:fs/promises";
import { rebuild, writePdf } from "@piro0919/image-to-pdf/node";

// apiKey can be left out: it is read from ANTHROPIC_API_KEY
const result = await rebuild(await readFile("photo.jpg"), { provider: "anthropic" });
await writePdf(result.html, "out.pdf");
```

The variables are `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and
`GOOGLE_GENERATIVE_AI_API_KEY`.

`writePdf` needs Chrome, Chromium or Edge installed. Set `CHROME_PATH` or pass
`{ chromePath }` if it is not found.

## API

### `rebuild(photo, options)`

- `photo`: `Blob`, `File`, `ArrayBuffer` or any typed array. PNG, JPEG, WebP or GIF.
  Photos whose base64 form is over 5 MB (the strictest provider limit found, Anthropic
  on Amazon Bedrock) are scaled down and re-encoded as JPEG in the browser; in Node they
  are rejected, so resize them first
- `options.provider`: `"anthropic"`, `"openai"` or `"google"`
- `options.apiKey`: optional. API key for that provider. In Node it falls back to the
  environment variable
- `options.model`: optional. With `provider`, a model ID (defaults to
  `DEFAULT_MODELS[provider]`). Without `provider`, an AI SDK model
- `options.signal`: optional `AbortSignal`

Returns `{ html, unclear, usage: { inputTokens, outputTokens }, model }`. `model` is the
model that wrote the page; with Claude Sonnet the request can fall back to another model
when it is declined, and `model` then names that one. Throws
`RebuildError` (with `provider` and `reason`) when the model stops before finishing the
page.

Default models:

| Provider | Model |
| --- | --- |
| `anthropic` | `claude-sonnet-5-5` |
| `openai` | `gpt-6.2-sol` |
| `google` | `gemini-3.8-flash` |

### `openPrint(html)` (browser)

Loads the HTML into a hidden, sandboxed frame and opens the print dialog. Resolves when
`print()` returns, which in some browsers is when the dialog closes and in others as soon
as it opens.

The browser's own headers and footers (date, title, page URL, page numbers) are left out
of the printed page. This was checked in Chrome; Safari and Firefox are untested.

### `writePdf(html, path, { chromePath? })` (Node)

Writes the HTML to a PDF file with a local headless Chrome.

## License

MIT
