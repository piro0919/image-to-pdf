export type MediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
export type EncodedImage = { data: string; mediaType: MediaType };

/** Photo the caller passes in: a browser File or Blob, or raw bytes. */
export type Photo = Blob | ArrayBuffer | ArrayBufferView;

// Anthropic の上限は画像1枚 base64 で 10MB（自社 API）、Amazon Bedrock 経由なら 5MB。
// 確かめた中で最も厳しい 5MB に合わせる
const MAX_BASE64_MB = 5;
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;
export const MAX_BASE64_BYTES = MAX_BASE64_MB * BYTES_PER_MB;

// 形式ごとの先頭のバイト。1文字が1バイトに当たるように \x で書く
const PNG_SIGNATURE = "\x89PNG";
const JPEG_SIGNATURE = "\xff\xd8\xff";
const GIF_SIGNATURE = "GIF8";
const RIFF_SIGNATURE = "RIFF";
const WEBP_FOURCC = "WEBP";
// RIFF の入れ物は、先頭4バイトの印と4バイトの長さの後に、中身の種類（WEBP など）が来る
const RIFF_FOURCC_OFFSET = 8;

// 中身の先頭のバイトで形式を見分ける。ファイル名や Blob.type は当てにしない
export function detectMediaType(bytes: Uint8Array): MediaType {
  const has = (signature: string, offset = 0) =>
    [...signature].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
  if (has(PNG_SIGNATURE)) return "image/png";
  if (has(JPEG_SIGNATURE)) return "image/jpeg";
  if (has(GIF_SIGNATURE)) return "image/gif";
  if (has(RIFF_SIGNATURE) && has(WEBP_FOURCC, RIFF_FOURCC_OFFSET)) return "image/webp";
  throw new Error("Unsupported image format. Use PNG, JPEG, WebP or GIF.");
}

// ブラウザでも Node でも動くように Buffer を使わない
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// base64 は 3 バイトを 4 文字にする
const BASE64_INPUT_BYTES = 3;
const BASE64_OUTPUT_CHARS = 4;
const base64Length = (byteLength: number) =>
  Math.ceil(byteLength / BASE64_INPUT_BYTES) * BASE64_OUTPUT_CHARS;

// 縮めるときに試す長い辺の長さ。大きい順に試し、上限に収まった最初のものを使う
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- 試す寸法の表
const SHRINK_LONG_EDGES = [3000, 2400, 2000, 1600];
const JPEG_QUALITY = 0.9;

// 別の realm（iframe・worker）から来た値でも見分けられるよう instanceof を使わない
async function toBytes(photo: Photo): Promise<Uint8Array> {
  if (ArrayBuffer.isView(photo)) return new Uint8Array(photo.buffer, photo.byteOffset, photo.byteLength);
  if (Object.prototype.toString.call(photo) === "[object ArrayBuffer]") return new Uint8Array(photo as ArrayBuffer);
  if (typeof (photo as Blob).arrayBuffer === "function") return new Uint8Array(await (photo as Blob).arrayBuffer());
  throw new TypeError("photo must be a Blob, File, ArrayBuffer or typed array.");
}

// 大きすぎる写真は、ブラウザなら縮めて JPEG にし直す。Node には描画の仕組みが無いので断る
async function shrink(bytes: Uint8Array, mediaType: MediaType): Promise<Uint8Array> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
    throw new Error(
      `The photo is too large (${(bytes.length / BYTES_PER_MB).toFixed(1)} MB). Resize it so its base64 form is under ${MAX_BASE64_MB} MB.`,
    );
  }
  const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mediaType }));
  try {
    for (const longEdge of SHRINK_LONG_EDGES) {
      const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
      if (base64Length(blob.size) <= MAX_BASE64_BYTES) return new Uint8Array(await blob.arrayBuffer());
    }
  } finally {
    bitmap.close();
  }
  throw new Error("The photo could not be made small enough to send.");
}

export async function encodePhoto(photo: Photo): Promise<EncodedImage> {
  let bytes = await toBytes(photo);
  let mediaType = detectMediaType(bytes);
  if (base64Length(bytes.length) > MAX_BASE64_BYTES) {
    bytes = await shrink(bytes, mediaType);
    mediaType = "image/jpeg";
  }
  return { data: toBase64(bytes), mediaType };
}
