import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectMediaType, encodePhoto, toBase64 } from "../src/image.ts";

const png = readFileSync(new URL("../spike/samples/ja-referral.png", import.meta.url));
const jpeg = readFileSync(new URL("../spike/samples/ja-army-orders.jpg", import.meta.url));

describe("detectMediaType", () => {
  it("reads the format from the bytes, not the name", () => {
    expect(detectMediaType(png)).toBe("image/png");
    expect(detectMediaType(jpeg)).toBe("image/jpeg");
    expect(detectMediaType(new TextEncoder().encode("GIF89a......"))).toBe("image/gif");
    expect(detectMediaType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("rejects anything else", () => {
    expect(() => detectMediaType(new TextEncoder().encode("%PDF-1.7"))).toThrow(/Unsupported/);
    expect(() => detectMediaType(new TextEncoder().encode("RIFF\0\0\0\0WAVE"))).toThrow(/Unsupported/);
  });
});

describe("toBase64", () => {
  it("matches Buffer's encoding, including inputs larger than one chunk", () => {
    expect(toBase64(jpeg)).toBe(jpeg.toString("base64"));
    expect(toBase64(new Uint8Array())).toBe("");
  });
});

describe("encodePhoto", () => {
  it("accepts a Blob, an ArrayBuffer and raw bytes alike", async () => {
    const expected = { data: png.toString("base64"), mediaType: "image/png" };
    const bytes = new Uint8Array(png);
    expect(await encodePhoto(bytes)).toEqual(expected);
    expect(await encodePhoto(bytes.buffer)).toEqual(expected);
    expect(await encodePhoto(new Blob([bytes], { type: "application/octet-stream" }))).toEqual(expected);
  });
});
