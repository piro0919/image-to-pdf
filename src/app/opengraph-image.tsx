import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { iconDataUrl } from './_components/icon-art';

export const alt = 'image-to-pdf';

export const size = { height: 630, width: 1200 };

export const contentType = 'image/png';

const TITLE = 'image-to-pdf';
const DESCRIPTION =
  'Rebuilds a photo of a paper document as a clean PDF with real text and tables.';
const ART_SIZE = 360;

export default async function Image() {
  /* The same Newsreader the site uses for headings, cut down to Latin. Change the
     copy and rebuild it per assets/README.md. */
  const font = await readFile(join(process.cwd(), 'assets/Newsreader-700-subset.ttf'));
  const art = await iconDataUrl();

  /* Same layout as the other package cards on kkweb.io: name, one line and
     the domain on the left, what the package does on the right. */
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: '#0d0f12',
        color: '#ffffff',
        display: 'flex',
        height: '100%',
        padding: '0 80px',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: 600,
        }}
      >
        <div style={{ display: 'flex', fontFamily: 'Newsreader', fontSize: 64, letterSpacing: -1 }}>
          {TITLE}
        </div>
        <div
          style={{
            color: '#a1a1aa',
            display: 'flex',
            fontSize: 30,
            lineHeight: 1.4,
            marginTop: 28,
          }}
        >
          {DESCRIPTION}
        </div>
        <div style={{ color: '#71717a', display: 'flex', fontSize: 26, marginTop: 48 }}>
          kkweb.io
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end' }}>
        <img alt="" height={ART_SIZE} src={art} width={ART_SIZE} />
      </div>
    </div>,
    {
      ...size,
      fonts: [{ data: font, name: 'Newsreader', style: 'normal', weight: 700 }],
    },
  );
}
