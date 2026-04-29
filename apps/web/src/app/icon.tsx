import { ImageResponse } from 'next/og'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#05070C',
          color: '#e4c16e',
          fontFamily: 'serif',
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: 132,
          letterSpacing: -4,
          borderRadius: 38,
        }}
      >
        Z
      </div>
    ),
    { ...size },
  )
}
