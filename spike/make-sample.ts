// samples/*.html（作り話の書類）から、写真の代わりになる PNG を作る
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToPng } from './chrome.ts';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'samples');

for (const name of readdirSync(dir).filter((f) => f.endsWith('.html'))) {
  const png = path.join(dir, name.replace(/\.html$/, '.png'));
  htmlToPng(path.join(dir, name), png, 1400, 1800);
  console.log(png);
}
