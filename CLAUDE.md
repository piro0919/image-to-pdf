# image-to-pdf

Takes a photo of a paper document — shot on a phone, printed text and handwriting mixed —
reads it, and rebuilds it as a clean PDF: real text, with the tables and boxes of the
original laid out again. Not a photo pasted into a PDF.

Published as `@piro0919/image-to-pdf` on npm. The landing page doubles as the service:
anyone can use it there with their own API key.

Agreed on 2026-11-20 in a sounding-board session started from the home directory.
The package (`src/`), a spike script (`spike/`) and the landing page (`src/app/`) exist.
The full discussion is in
`~/.claude/projects/-Users-piro/b72ff8e7-8ec0-47af-a3ef-37bfd3015e6c.jsonl`.

## What it does

- Input: a photo of a document. Printed and handwritten text, often both on one page
- Output: a PDF typeset from the recognised text, reproducing the layout — tables, boxes,
  where things sit on the page. Lines in order is not enough
- Any language from the first version, not just Japanese and English
- General purpose. The idea came from care work (doctors' reports photographed on a phone),
  but the package is not tied to that

## Key decisions

- **Rebuilt, not overlaid.** Most "image to PDF" tools paste the image onto a page; the
  "searchable PDF" tools (Smallpdf, PDF24, Sejda) keep the image and hide a text layer under
  it. This one replaces the image with typeset text. Early in the session these were mixed
  up for a long stretch — keep the distinction explicit
- **A vision-capable LLM does the reading, not classic OCR.** Layout has to be rebuilt and
  handwriting is in scope; classic OCR is weak at both:
  - Tesseract is weak at Japanese, especially from phone photos
  - NDLOCR-Lite (National Diet Library, CC BY 4.0, CPU only) is strong on printed Japanese,
    but handwriting is "experimental". It gives line-level boxes only, no per-character
    positions, and its layout classes (`src/config/ndl.yaml`) mark a `block_table` region
    but have no notion of cells. Its layout backbone is distilled from DINOv3, so
    redistributing its models also binds you to the DINOv3 licence
- **Claude, OpenAI and Gemini are all supported** (decided 2026-11-20, widened from
  Claude only). Users bring their own key, so supporting the main providers lets people
  use the key they already have. Accuracy has to be measured per provider
  - CORS preflight (`OPTIONS` with an `Origin`) was checked on 2026-11-20 against
    `api.anthropic.com/v1/messages`, `api.openai.com/v1/responses` and
    `/v1/chat/completions`, and Gemini `generateContent`: all allowed. Gemini returned 403
    when the request listed other providers' headers, and passed with only `content-type`
    and `x-goog-api-key`. A real keyed call from a browser has not been made yet
- **Users bring their own API key.** On the landing page the key is entered by the user and
  never paid for by us — no rate limiting or billing to build. The intent is for the
  browser to call the provider directly so the key never passes through our server.
  Anthropic needs the `anthropic-dangerous-direct-browser-access: true` header for that,
  which `src/providers.ts` sets. See "Checked so far" below for what has been tried
- **Requests go through Vercel's AI SDK** (`ai` and `@ai-sdk/anthropic|openai|google`),
  not the providers' own SDKs. Switched on 2026-11-20 so the `model` type follows the
  provider packages: the owner wanted model IDs typed and kept current without updating
  this package ("型を効かせたい", then "まかせる"). The official SDKs type Claude and OpenAI
  model IDs but Gemini's has only `string`; the AI SDK packages have all three, as
  `known IDs | (string & {})`, read off `languageModel` / `responses` parameters because
  the ID types are not exported by name
- **PDF output goes through HTML and the browser's print-to-PDF.** The model's result
  becomes HTML; the browser handles text shaping and direction for every script
  - Checked with headless Chrome on 2026-11-20: Arabic joined and ran right-to-left, an
    Arabic table laid out right-to-left, Japanese and English correct
  - One catch: inside an Arabic paragraph `2026-11-20` rendered as `20-11-2026`. Wrapping
    it in `<bdi dir="ltr">` fixed it. Numbers, dates and units need isolating like this
  - Not using pdf-lib or jsPDF: pdf-lib was last pushed in July 2024 and has an open bug
    where numbers come out reversed in Arabic (#1450); jsPDF has open issues on Arabic
    fonts not rendering (#3867) and alignment (#2747). Neither was tried for Japanese
- **Name**: `@piro0919/image-to-pdf`. `image-to-pdf`, `image2pdf` and `img2pdf` are taken
  on npm. The owner wanted a plain name that says "image" up front. The trade-off, noted
  when choosing: the name is also what the paste-the-image tools are called, so it does not
  say the document gets rebuilt
  - Rejected candidates: Utsushi, Shakyo, Kakiutsu, Retypo, Photype (not obvious enough),
    retype-pdf, photo-retype, paper-to-pdf, snap2doc, photo2pdf, image-retype,
    img-retype, image-to-doc, image2doc, image-rebuild

## Cost estimate (not measured)

Roughly per page: about ¥6 on Claude Sonnet 5.5, about ¥0.3 on Claude Haiku 5.5. Based on
list prices ($2/$10 and $0.10/$0.50 per million tokens), up to ~4,800 input tokens for a
high-resolution image, an assumed ~3,000 output tokens per page, and ¥150 to the dollar.
Users pay this, not us, but it matters for which model to default to.

## Not decided yet

- Whether to keep the original photo next to the rebuilt PDF so the two can be compared.
  An LLM can fill an unreadable spot with plausible text; without the photo nobody can
  tell. For medical documents this is the biggest risk
- Why someone would pick this over existing tools (accuracy on handwriting, price, ease)
- Accuracy. Not measured for any language. Needs sample photos with printed and handwritten
  text mixed; real documents are personal data, so the samples have to be made up.
  Anthropic's per-language scores measure text understanding, not reading handwriting
  - First spike run, 2026-11-20, OpenAI only (no other keys yet), judged by eye against
    the samples in `spike/samples/` (sources in `SOURCES.md`). `gpt-6.2-sol` kept the
    layout of all four, including vertical Japanese handwriting and a ruled table, and
    marked most doubtful spots as unclear. `gpt-6-luna` scrambled the vertical-writing
    page and misread words and numbers without marking them (e.g. 青年勤勞隊 →
    青年事業費隊, 五、一五 → 二一五). The cheap tier's real danger is confident wrong text
- Default provider and model. The spike (`spike/`, `pnpm spike <image> [model...]`)
  compares Claude Sonnet 5.5 / Haiku 5.5, OpenAI `gpt-6.2-sol` / `gpt-6-luna`, and Gemini
  `gemini-3.8-flash` / `gemini-3.5-flash-lite`. Prices are in `spike/run.ts`.
  Whether the two OpenAI models accept images was not stated on OpenAI's pricing page

## Package API (agreed 2026-11-20)

Implemented in `src/`. Names (`rebuild`, `openPrint`, `writePdf`) and the default models
were left to Claude by the owner ("すべてまかせる").

- One call takes a photo (`File` / `Blob` in the browser, `Uint8Array` in Node) and
  either `{ provider, model?, apiKey? }` or `{ model }` with an AI SDK model, and returns
  `{ html, unclear, usage, model }`
  - `{ model }` replaces the `client` option that briefly took the official SDK clients
    (asked for with "対応を"): a proxy `baseURL`, Bedrock, Azure or a gateway ID all
    become an AI SDK model. Only Claude, OpenAI and Gemini have been tried
  - `apiKey` is optional because each provider package falls back to its environment
    variable in Node (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
    `GOOGLE_GENERATIVE_AI_API_KEY`)
  - `html`: a complete A4-printable document, the model's output used as is
  - `unclear`: how many spots the model marked with `<mark class="unclear">`
  - `usage`: input and output tokens, for showing the cost
- Turning HTML into a PDF is separate, per runtime:
  - Browser: put the HTML in a print frame and open the print dialog; the user picks
    "Save as PDF". MDN describes `window.print()` only as opening the dialog, with no way
    to skip it. The landing page's flow ends in that dialog, and the owner accepted that
  - Node: a separate entry point (`@piro0919/image-to-pdf/node`) writes the PDF with a
    local headless Chrome, as the spike does
- Default models are the upper tier of each provider (`DEFAULT_MODELS` in
  `src/providers.ts`), because `gpt-6-luna` misread text without marking it
- `ai` and the provider packages are loaded with dynamic `import()` so a browser bundle
  only fetches the provider in use. They are plain `dependencies`: the `.d.ts` imports
  their types, so they must be installed
- Anthropic's server-side fallback is turned on with the AI SDK option
  `providerOptions.anthropic.fallbacks: "default"` (the package adds the beta header);
  the model it handed to comes back as a `custom` content part `anthropic.fallback`
- Checked 2026-11-20 from a packed tarball in an empty project: types pass under
  `nodenext` and `bundler` with `skipLibCheck: true`. With `skipLibCheck: false` the one
  error is inside `@ai-sdk/provider` (no types for `json-schema`), which any AI SDK user
  gets

### Checked so far (2026-11-20)

- Browser → OpenAI with a real key: works. Bundled `dist/` with esbuild, served on
  localhost, called `rebuild()` from Playwright's Chromium. Anthropic and Gemini have
  not been called from a browser with a real key (no keys yet)
  - After the switch to the AI SDK: the landing page read `ja-referral.png` with
    `gpt-6.2-sol` (3,259 input tokens, the same as before, so `imageDetail: "high"`
    reaches OpenAI), and `pnpm spike` read it in Node with `gpt-6-luna`. The page loads
    only the OpenAI provider's code when OpenAI is used
  - A wrong key: OpenAI's 401 has no `access-control-allow-origin`, so the browser only
    sees "Failed to fetch"; the landing page turns that into "Check the API key and your
    connection". Anthropic (with the direct-browser header) and Gemini send CORS headers
    on errors, and the page shows Anthropic's own "invalid x-api-key"
- `openPrint()`: in Playwright's Chromium no dialog appears and `afterprint` never fires.
  It resolves when `print()` returns and removes the frame on `afterprint` or on the next
  call, never on a timer, so a slow user cannot end up printing an emptied frame.
  In a normal Google Chrome (separate profile, driven over CDP, 2026-11-20) the
  "Save as PDF" button opened Chrome's print preview showing the rebuilt document, not
  the landing page. The destination defaulted to the system printer, so the user has to
  pick "Save as PDF" there. Chrome's default headers and footers were on at first: the
  date, the document title, `localhost:3020` and `1/1` printed in the margins.
  `openPrint` now adds empty `@top-left` and `@bottom-left` page margin boxes
  (`hidePrintHeaders` in `src/html.ts`); Chrome then prints none of them. Checked the same
  day on a two-page document (both pages clean, the 15 mm `@page` margin kept) and through
  the landing page's own button. Setting `@page { margin: 0 }` also hid them but lost the
  margin on inner page edges. Safari and Firefox are untested
- Large photos: Anthropic takes at most 10 MB of base64 per image on its own API and
  5 MB on Amazon Bedrock, with images up to 8000×8000 px (English vision docs,
  "Request limits", read 2026-11-20). Gemini 20 MB per request, OpenAI's limit was not
  found. `encodePhoto` keeps everything under 5 MB, which leaves room under all of
  these: in the browser it scales down to JPEG (a 26 MB PNG became 2400×1800, 3.9 MB,
  in Playwright's Chromium); Node has no canvas, so it throws instead
- The packed tarball type-checks from a consumer project under `nodenext` and `bundler`
  resolution. `src/` imports use `.js` because `.ts` paths leaked into the `.d.ts` files;
  the spike therefore runs against `dist/` (`pnpm spike` builds first). The landing page
  does the same: it imports `@piro0919/image-to-pdf` by name, which resolves to `dist/`
  through the package's own `exports`. Turbopack does not map a `.js` import to a `.ts`
  file, so importing `src/` directly fails to build
- Competitors for the rebuild approach were only searched lightly. Several "image to Word"
  tools exist and some claim to rebuild tables (imagetotable.ai), untested. No tool for
  care workers was found

## Landing page (agreed 2026-11-20)

- Next.js in this repo (`src/app/`), published on Vercel at `image-to-pdf.kkweb.io`,
  the same setup as the owner's other npm packages (use-pwa, next-unused,
  unicode-range-split). Layout follows unicode-range-split and next-intl-alternates:
  `npm i` line, heading, the working tool, a usage snippet, footer links
- `pnpm dev` / `pnpm build` build the package first (`build:lib`), then Next.js
- The page is static; the browser calls the provider directly, so no function region
  to choose
- Flow: provider, key, photo, "Rebuild", then "Save as PDF" calls `openPrint`. Printing
  is a separate button rather than opening on its own after the model answers

## Conventions

- Public repo: README, CLAUDE.md, docs, package.json description and commits in English.
  Code comments may be Japanese
- Commits: Conventional Commits, `type(scope): lowercase description`. Push to main
- Tooling copied on 2026-11-20 from the owner's other repos (magao as the model): ESLint
  with `@piro0919/eslint-config` (magic numbers and Tailwind arbitrary values fail; name
  the value or add a `@theme` token), Prettier, lefthook with commitlint, secretlint, knip,
  Renovate, `.nvmrc` and a CI workflow running the same checks
- TypeScript runs side by side, as the TypeScript 7.0 announcement describes:
  `typescript` is aliased to `@typescript/typescript6` because typescript-eslint stops
  with "does not support TS 7.0", and `@typescript/native` is TypeScript 7, which owns
  the `tsc` binary used by `typecheck` and `build:lib`. Drop the alias once
  typescript-eslint supports TypeScript 7
