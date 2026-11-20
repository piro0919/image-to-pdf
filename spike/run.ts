// 試作: 書類の写真 → AI → HTML → PDF。ビルドしたパッケージ（dist/）をそのまま使う
// 使い方: pnpm spike <画像> [モデル...]
//   モデルを省くと、.env にキーがある提供元のモデルをすべて流す
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Provider, rebuild, writePdf } from '../dist/node.js';

const JPY_PER_USD = 150;

// 料金は USD / 100万トークン。2026-11-20 に各社の料金表で確認
// Gemini 3.8 Flash は 2026-12-31 までの値（2027-01-01 から $1.50 / $7.50）
const MODELS = {
  'claude-sonnet': { provider: 'anthropic', id: 'claude-sonnet-5-5', inUsd: 2, outUsd: 10 },
  'claude-haiku': { provider: 'anthropic', id: 'claude-haiku-5-5', inUsd: 0.1, outUsd: 0.5 },
  'openai-sol': { provider: 'openai', id: 'gpt-6.2-sol', inUsd: 2, outUsd: 10 },
  'openai-luna': { provider: 'openai', id: 'gpt-6-luna', inUsd: 0.1, outUsd: 0.5 },
  'gemini-flash': { provider: 'google', id: 'gemini-3.8-flash', inUsd: 0.75, outUsd: 3.75 },
  'gemini-flash-lite': { provider: 'google', id: 'gemini-3.5-flash-lite', inUsd: 0.3, outUsd: 2.5 },
} as const satisfies Record<
  string,
  { provider: Provider; id: string; inUsd: number; outUsd: number }
>;
type ModelKey = keyof typeof MODELS;

const KEY_ENV: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GEMINI_API_KEY',
};

const [imageArg, ...modelArgs] = process.argv.slice(2);
const unknown = modelArgs.filter((m) => !(m in MODELS));
if (!imageArg || unknown.length > 0) {
  console.error(`usage: pnpm spike <image> [${Object.keys(MODELS).join('|')} ...]`);
  process.exit(1);
}
const keys = (modelArgs.length > 0 ? modelArgs : Object.keys(MODELS)) as ModelKey[];
const runnable = keys.filter((k) => process.env[KEY_ENV[MODELS[k].provider]]);
for (const k of keys.filter((k) => !runnable.includes(k))) {
  console.error(`skip ${k}: ${KEY_ENV[MODELS[k].provider]} is not set`);
}

const imagePath = path.resolve(imageArg);
const photo = readFileSync(imagePath);
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(outDir, { recursive: true });

await Promise.all(
  runnable.map(async (key) => {
    const model = MODELS[key];
    const started = Date.now();
    try {
      const result = await rebuild(photo, {
        provider: model.provider,
        model: model.id,
        apiKey: process.env[KEY_ENV[model.provider]] ?? '',
      });
      const base = path.join(outDir, `${path.basename(imagePath, path.extname(imagePath))}-${key}`);
      writeFileSync(`${base}.html`, result.html);
      await writePdf(result.html, `${base}.pdf`);
      const { inputTokens, outputTokens } = result.usage;
      const usd = (inputTokens * model.inUsd + outputTokens * model.outUsd) / 1_000_000;
      const report = {
        model: result.model,
        seconds: (Date.now() - started) / 1000,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        unclear: result.unclear,
        usd: Number(usd.toFixed(4)),
        jpy: Number((usd * JPY_PER_USD).toFixed(2)),
      };
      writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
      console.log(`${base}.pdf`, report);
    } catch (error) {
      console.error(`${key} failed:`, error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }),
);
