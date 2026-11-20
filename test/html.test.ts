import { describe, expect, it } from "vitest";
import { cleanHtml, countUnclear } from "../src/html.ts";

describe("cleanHtml", () => {
  it("leaves plain HTML alone", () => {
    expect(cleanHtml("  <!doctype html><p>a</p>\n")).toBe("<!doctype html><p>a</p>");
  });

  it("strips a code fence the model added against instructions", () => {
    expect(cleanHtml("```html\n<!doctype html><p>a</p>\n```")).toBe("<!doctype html><p>a</p>");
    expect(cleanHtml("```\n<p>a</p>```")).toBe("<p>a</p>");
  });
});

describe("countUnclear", () => {
  it("counts marked spots but not the .unclear rule in the stylesheet", () => {
    const html = `<style>.unclear{background:yellow} mark.unclear{}</style>
      <p><mark class="unclear">417</mark> and <mark class='note unclear'>Hirtle</mark></p>`;
    expect(countUnclear(html)).toBe(2);
  });

  it("ignores other marks and similar class names", () => {
    expect(countUnclear(`<mark>x</mark><mark class="unclearly">y</mark><span class="unclear">z</span>`)).toBe(0);
  });
});
