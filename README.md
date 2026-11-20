# @piro0919/image-to-pdf

Turn a photo of a paper document into a clean PDF. The page is read by an AI model and
typeset again as real text, with its tables, boxes and checkboxes laid out like the
original. It is not the photo pasted into a PDF.

Printed and handwritten text, in any language. Works with Claude, OpenAI or Gemini, using
your own API key.

> Status: early. Not published to npm yet.

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

Then install the SDK of each provider you use. They are optional peer dependencies, so
you only get the ones you need:

```sh
npm install @anthropic-ai/sdk # Claude
npm install openai            # OpenAI
npm install @google/genai     # Gemini
```

If you pass your own `client` (see below), this package never imports the SDK itself.

## Browser

```ts
import { openPrint, rebuild } from "@piro0919/image-to-pdf";

const { html, unclear, usage } = await rebuild(file, {
  provider: "openai", // "anthropic" | "openai" | "google"
  apiKey,             // the user's own key
});

await openPrint(html); // opens the print dialog; choose "Save as PDF"
```

The browser calls the provider directly, so the key never passes through a server of
yours. Anyone who can open the page's developer tools can see the key, so only use keys
that belong to the person using the page.

To use your own key from the browser without exposing it, send the request through your
server by passing a client whose `baseURL` points there:

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "/api/openai", // your proxy adds the key
  apiKey: "unused",
  dangerouslyAllowBrowser: true,
});
const { html } = await rebuild(file, { provider: "openai", client });
```

## Node

```ts
import { readFile } from "node:fs/promises";
import { rebuild, writePdf } from "@piro0919/image-to-pdf/node";

// apiKey can be left out: the SDK reads ANTHROPIC_API_KEY
const result = await rebuild(await readFile("photo.jpg"), { provider: "anthropic" });
await writePdf(result.html, "out.pdf");
```

Each SDK reads its usual variable: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or
`GEMINI_API_KEY` / `GOOGLE_API_KEY`.

`writePdf` needs Chrome, Chromium or Edge installed. Set `CHROME_PATH` or pass
`{ chromePath }` if it is not found.

## API

### `rebuild(photo, options)`

- `photo`: `Blob`, `File`, `ArrayBuffer` or any typed array. PNG, JPEG, WebP or GIF.
  Photos whose base64 form is over 5 MB (the strictest provider limit found, Anthropic
  on Amazon Bedrock) are scaled down and re-encoded as JPEG in the browser; in Node they
  are rejected, so resize them first
- `options.provider`: `"anthropic"`, `"openai"` or `"google"`
- `options.apiKey`: optional. API key for that provider. In Node, the SDK falls back to
  its environment variable. Ignored when `client` is given
- `options.client`: optional. An SDK client you built yourself (`new Anthropic()`,
  `new OpenAI()`, `new GoogleGenAI()`), for a proxy `baseURL`, a custom `fetch` and so
  on. Its settings are used as they are
- `options.model`: optional. Defaults to `DEFAULT_MODELS[provider]`
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

### `writePdf(html, path, { chromePath? })` (Node)

Writes the HTML to a PDF file with a local headless Chrome.

## License

MIT
