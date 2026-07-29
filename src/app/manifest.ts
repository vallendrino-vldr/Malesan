import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Malesan',
    short_name: 'Malesan',
    description: 'Males mikirnya. Bukan bikinnya.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#0b0a09',
    theme_color: '#0b0a09',
    icons: [
      {
        src: '/icon.png',
        sizes: 'any',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
