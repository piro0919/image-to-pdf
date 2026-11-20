// モデルが指示に反してコードブロックで囲んだときだけ外す
export function cleanHtml(text: string): string {
  return text
    .trim()
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

// <style> の中の .unclear は数えず、印を付けた <mark> だけを数える
export function countUnclear(html: string): number {
  return html.match(/<mark\b[^>]*\bclass\s*=\s*["'][^"']*\bunclear\b[^"']*["']/gi)?.length ?? 0;
}
