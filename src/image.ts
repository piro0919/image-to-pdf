export type MediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
export type EncodedImage = { data: string; mediaType: MediaType };

/** Photo the caller passes in: a browser File or Blob, or raw bytes. */
export type Photo = Blob | Uint8Array | ArrayBuffer;

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

export async function encodePhoto(photo: Photo): Promise<EncodedImage> {
  const bytes =
    photo instanceof Uint8Array
      ? photo
      : photo instanceof ArrayBuffer
        ? new Uint8Array(photo)
        : new Uint8Array(await photo.arrayBuffer());
  return { data: toBase64(bytes), mediaType: detectMediaType(bytes) };
}
