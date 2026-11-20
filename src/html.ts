// モデルが指示に反してコードブロックで囲んだときだけ外す
export function cleanHtml(text: string): string {
  return text
    .trim()
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

// ブラウザの印刷は既定で余白に日付・題・URL・ページ番号を入れる。余白の箱に空の中身を置くと Chrome はそれを出さない
// （2026-11-20 に Chrome で、上下とも置けば2ページとも消え、@page の余白はそのまま残ることを確かめた）
const NO_PRINT_HEADERS = `<style>@page { @top-left { content: ""; } @bottom-left { content: ""; } }</style>`;

export function hidePrintHeaders(html: string): string {
  return /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, `${NO_PRINT_HEADERS}$&`)
    : `${NO_PRINT_HEADERS}${html}`;
}

// <style> の中の .unclear は数えず、印を付けた <mark> だけを数える。class の値は引用符なしも許す
export function countUnclear(html: string): number {
  return (
    html.match(
      /<mark\b[^>]*\bclass\s*=\s*(?:"[^"]*\bunclear\b[^"]*"|'[^']*\bunclear\b[^']*'|unclear(?=[\s>/]))/gi,
    )?.length ?? 0
  );
}
