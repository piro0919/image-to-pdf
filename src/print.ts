/**
 * Browser only. Loads the HTML into a hidden frame and opens the print dialog,
 * where the user can choose "Save as PDF". Resolves when the dialog closes.
 */
export function openPrint(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
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
      // 枠は印刷が終わってから外す。print() が画面を閉じるまで戻らないブラウザばかりとは限らず、
      // 戻ってすぐ外すと白紙を印刷しかねないので afterprint を待つ。来なければ1分で外す
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        frame.remove();
        resolve();
      };
      const timer = setTimeout(finish, 60_000);
      win.addEventListener("afterprint", finish, { once: true });
      win.focus();
      win.print();
    };
    document.body.append(frame);
  });
}
