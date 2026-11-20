// 試作: 書類の写真 → AI → HTML → PDF
// 使い方: pnpm spike <画像> [モデル...]
//   モデルを省くと、.env にキーがある提供元のモデルをすべて流す
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { htmlToPdf } from "./chrome.ts";
import { type Image, KEY_ENV, MODELS, type ModelKey, read } from "./providers.ts";

const JPY_PER_USD = 150;

const SYSTEM = `You rebuild photographed paper documents as clean, printable HTML.

The user sends a phone photo of one page. It may mix printed and handwritten text, in any language.
Return one complete HTML document that, printed to A4, reproduces the original page:
- The same text, transcribed exactly as written. Do not correct, summarise, translate or complete it.
- The same layout: tables with the same rows, columns and merged cells; boxes; checkboxes and their state; headings; where blocks sit on the page (left, right, centred). Ignore the photo's tilt, shadows and background.
- Set lang on <html>. For right-to-left scripts set dir="rtl", and wrap numbers, dates and units inside RTL text in <bdi dir="ltr">.
- Use system font stacks only; no external resources, no scripts, no images.
- Use @page { size: A4; margin: 15mm } and fit the page.
- Where something cannot be read with confidence, write your best reading inside <mark class="unclear">…</mark>, and style .unclear so it stands out. Never invent text that is not there.
- Stamps, seals and signatures: render their text if legible, with a thin border, and do not try to draw them.

Reply with the HTML only, starting with <!doctype html>. No explanation, no code fences.`;

const [imageArg, ...modelArgs] = process.argv.slice(2);
const unknown = modelArgs.filter((m) => !(m in MODELS));
if (!imageArg || unknown.length > 0) {
  console.error(`usage: pnpm spike <image> [${Object.keys(MODELS).join("|")} ...]`);
  process.exit(1);
}
const keys = (modelArgs.length > 0 ? modelArgs : Object.keys(MODELS)) as ModelKey[];
const runnable = keys.filter((k) => process.env[KEY_ENV[MODELS[k].provider]]);
for (const k of keys.filter((k) => !runnable.includes(k))) {
  console.error(`skip ${k}: ${KEY_ENV[MODELS[k].provider]} is not set`);
}

const imagePath = path.resolve(imageArg);
const ext = path.extname(imagePath).toLowerCase();
const image: Image = {
  data: readFileSync(imagePath).toString("base64"),
  mediaType: ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg",
};
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(outDir, { recursive: true });

await Promise.all(
  runnable.map(async (key) => {
    const model = MODELS[key];
    const started = Date.now();
    try {
      const reading = await read(key, image, SYSTEM);
      const html = reading.text
        .trim()
        .replace(/^```(?:html)?\s*/i, "")
        .replace(/```$/, "")
        .trim();
      const base = path.join(outDir, `${path.basename(imagePath, ext)}-${key}`);
      writeFileSync(`${base}.html`, html);
      htmlToPdf(`${base}.html`, `${base}.pdf`);
      const usd = (reading.inputTokens * model.inUsd + reading.outputTokens * model.outUsd) / 1_000_000;
      const report = {
        model: model.id,
        seconds: (Date.now() - started) / 1000,
        input_tokens: reading.inputTokens,
        output_tokens: reading.outputTokens,
        usd: Number(usd.toFixed(4)),
        jpy: Number((usd * JPY_PER_USD).toFixed(2)),
        stop_reason: reading.stopReason,
      };
      writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
      console.log(`${base}.pdf`, report);
    } catch (error) {
      console.error(`${key} failed:`, error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }),
);
