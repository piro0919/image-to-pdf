import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/* The icon as a data URL, for the cards drawn with ImageResponse. iOS rounds the
   corners itself, so the apple icon asks for square ones. */
export async function iconDataUrl({ square = false } = {}): Promise<string> {
  let svg = await readFile(join(process.cwd(), 'src/app/icon.svg'), 'utf8');
  if (square) svg = svg.replace('rx="108"', 'rx="0"');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
