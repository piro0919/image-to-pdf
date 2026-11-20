import { ImageResponse } from 'next/og';
import { iconDataUrl } from './_components/icon-art';

export const size = { height: 180, width: 180 };

export const contentType = 'image/png';

export default async function AppleIcon() {
  const src = await iconDataUrl({ square: true });
  return new ImageResponse(<img alt="" height={size.height} src={src} width={size.width} />, {
    ...size,
  });
}
