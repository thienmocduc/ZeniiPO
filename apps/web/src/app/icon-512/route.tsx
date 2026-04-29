import { ImageResponse } from 'next/og'

export const runtime = 'edge'

// Maskable 512×512 icon — keeps the Z safely inside the inner 80% safe zone
// so PWA OS-level masking (Android adaptive icons) does not crop it.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#05070C',
          color: '#e4c16e',
          fontFamily: 'serif',
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: 280,
          letterSpacing: -8,
        }}
      >
        Z
      </div>
    ),
    { width: 512, height: 512 },
  )
}
