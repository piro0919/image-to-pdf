export type MediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
export type EncodedImage = { data: string; mediaType: MediaType };

/** Photo the caller passes in: a browser File or Blob, or raw bytes. */
export type Photo = Blob | ArrayBuffer | ArrayBufferView;

// Anthropic は画像1枚を base64 で 5MB までしか受け付けない。3社で最も厳しいのでこれに合わせる
export const MAX_BASE64_BYTES = 5 * 1024 * 1024;

// 中身の先頭のバイトで形式を見分ける。ファイル名や Blob.type は当てにしない
export function detectMediaType(bytes: Uint8Array): MediaType {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
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

const base64Length = (byteLength: number) => Math.ceil(byteLength / 3) * 4;

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
      `The photo is too large (${(bytes.length / 1024 / 1024).toFixed(1)} MB). Resize it so its base64 form is under 5 MB.`,
    );
  }
  const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mediaType }));
  try {
    for (const longEdge of [3000, 2400, 2000, 1600]) {
      const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
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
