import { describe, expect, it } from "vitest";
import { cleanHtml, countUnclear, hidePrintHeaders } from "../src/html.js";

describe("hidePrintHeaders", () => {
  it("adds empty top and bottom margin boxes inside the head", () => {
    const out = hidePrintHeaders("<html><head><style>@page { margin: 15mm }</style></HEAD><body>a</body></html>");
    expect(out).toMatch(/@top-left \{ content: ""; \}.*@bottom-left \{ content: ""; \}.*<\/style><\/HEAD><body>/);
    expect(out).toContain("@page { margin: 15mm }");
  });

  it("puts the rule first when the document has no head", () => {
    expect(hidePrintHeaders("<p>a</p>")).toMatch(/^<style>@page \{.*<\/style><p>a<\/p>$/);
  });
});

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

  it("counts an unquoted class value", () => {
    expect(countUnclear(`<mark class=unclear>417</mark><mark class=unclear/>`)).toBe(2);
  });

  it("ignores other marks and similar class names", () => {
    expect(countUnclear(`<mark class=unclearly>y</mark>`)).toBe(0);
    expect(countUnclear(`<mark>x</mark><mark class="unclearly">y</mark><span class="unclear">z</span>`)).toBe(0);
  });
});
