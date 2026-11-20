import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#0d0f12',
    display: 'standalone',
    icons: [
      { purpose: 'any', sizes: 'any', src: '/icon.svg', type: 'image/svg+xml' },
      { sizes: '180x180', src: '/apple-icon', type: 'image/png' },
    ],
    name: 'image-to-pdf',
    orientation: 'portrait',
    short_name: 'image-to-pdf',
    start_url: '/',
    theme_color: '#0d0f12',
  };
}
