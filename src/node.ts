// Node 用の入口。手元の Chrome（Chromium 系）で HTML を PDF に書き出す
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

export * from "./index.ts";

const run = promisify(execFile);

const CANDIDATES: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
};

export function findChrome(): string {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) return fromEnv;
  const found = CANDIDATES[process.platform]?.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome or Chromium was not found. Set CHROME_PATH or pass chromePath.");
  return found;
}

export type WritePdfOptions = { chromePath?: string };

/** Writes the HTML to a PDF file using a local headless Chrome. */
export async function writePdf(html: string, pdfPath: string, options: WritePdfOptions = {}): Promise<void> {
  const chrome = options.chromePath ?? findChrome();
  const dir = await mkdtemp(path.join(tmpdir(), "image-to-pdf-"));
  try {
    const htmlPath = path.join(dir, "page.html");
    await writeFile(htmlPath, html);
    await run(chrome, [
      "--headless",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--user-data-dir=${path.join(dir, "profile")}`,
      `--print-to-pdf=${path.resolve(pdfPath)}`,
      pathToFileURL(htmlPath).href,
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
