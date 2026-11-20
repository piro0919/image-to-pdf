# image-to-pdf

Takes a photo of a paper document — shot on a phone, printed text and handwriting mixed —
reads it, and rebuilds it as a clean PDF: real text, with the tables and boxes of the
original laid out again. Not a photo pasted into a PDF.

Published as `@piro0919/image-to-pdf` on npm. The landing page doubles as the service:
anyone can use it there with their own API key.

Agreed on 2026-11-20 in a sounding-board session started from the home directory.
The package (`src/`) and a spike script (`spike/`) exist; the landing page does not.
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
  browser to call the provider directly so the key never passes through our server. The
  Anthropic and OpenAI SDKs need `dangerouslyAllowBrowser: true`, which `src/providers.ts`
  sets. See "Checked so far" below for what has been tried
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
- How the landing page is built and hosted

## Package API (agreed 2026-11-20)

Implemented in `src/`. Names (`rebuild`, `openPrint`, `writePdf`) and the default models
were left to Claude by the owner ("すべてまかせる").

- One call takes a photo (`File` / `Blob` in the browser, `Uint8Array` in Node) and
  `{ provider, model?, apiKey }`, and returns `{ html, unclear, usage }`
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
- SDKs are loaded with dynamic `import()` so a browser bundle only fetches the provider
  in use. With esbuild code splitting each provider's chunk is about 1 MB unminified
  (measured 2026-11-20)

### Checked so far (2026-11-20)

- Browser → OpenAI with a real key: works. Bundled `dist/` with esbuild, served on
  localhost, called `rebuild()` from Playwright's Chromium. Anthropic and Gemini have
  not been called from a browser (no keys yet)
- `openPrint()`: in Playwright's Chromium no dialog appears and `afterprint` never fires,
  so the frame stays until the one-minute fallback. Whether the real dialog opens and
  prints the right page has not been seen in a normal browser yet, and Safari is
  untested
- Competitors for the rebuild approach were only searched lightly. Several "image to Word"
  tools exist and some claim to rebuild tables (imagetotable.ai), untested. No tool for
  care workers was found

## Conventions

- Public repo: README, CLAUDE.md, docs, package.json description and commits in English.
  Code comments may be Japanese
- Commits: Conventional Commits, `type(scope): lowercase description`. Push to main
