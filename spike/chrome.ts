import { execFileSync } from "node:child_process";
import { findChrome } from "../dist/node.js";

// HTML を画面写真として PNG にする（試験用の写真を作るため）
export function htmlToPng(htmlPath: string, pngPath: string, width: number, height: number): void {
  execFileSync(
    findChrome(),
    [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      `--screenshot=${pngPath}`,
      `--window-size=${width},${height}`,
      "--virtual-time-budget=5000",
      `file://${htmlPath}`,
    ],
    { stdio: "ignore" },
  );
}
