import { execFileSync } from "node:child_process";

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function chrome(args: string[]): void {
  execFileSync(CHROME, ["--headless", "--disable-gpu", "--hide-scrollbars", ...args], {
    stdio: "ignore",
  });
}

// HTML をブラウザの印刷機能で PDF にする
export function htmlToPdf(htmlPath: string, pdfPath: string): void {
  chrome([`--print-to-pdf=${pdfPath}`, "--no-pdf-header-footer", `file://${htmlPath}`]);
}

// HTML を画面写真として PNG にする（試験用の写真を作るため）
export function htmlToPng(htmlPath: string, pngPath: string, width: number, height: number): void {
  chrome([
    `--screenshot=${pngPath}`,
    `--window-size=${width},${height}`,
    "--virtual-time-budget=5000",
    `file://${htmlPath}`,
  ]);
}
