const FRAME_ATTR = "data-image-to-pdf-print";

/**
 * Browser only. Loads the HTML into a hidden, sandboxed frame and opens the print dialog,
 * where the user can choose "Save as PDF". Resolves when `print()` returns: after the
 * dialog closes in browsers where it blocks, or as soon as it opens in the others.
 */
export function openPrint(html: string): Promise<void> {
  // 前回の枠は、印刷が終わった合図が来なかった場合に備えてここで外す
  for (const old of document.querySelectorAll(`iframe[${FRAME_ATTR}]`)) old.remove();

  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute(FRAME_ATTR, "");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    // モデルの出力にスクリプトが混ざっても動かさない。印刷の画面を開くために allow-modals だけ許す
    frame.sandbox.add("allow-same-origin", "allow-modals");
    frame.srcdoc = html;
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) {
        frame.remove();
        reject(new Error("Could not open the print frame."));
        return;
      }
      // print() がすぐ戻るブラウザで枠を先に外すと白紙になるので、外すのは afterprint か次の呼び出しで
      win.addEventListener("afterprint", () => frame.remove(), { once: true });
      win.focus();
      win.print();
      resolve();
    };
    document.body.append(frame);
  });
}
