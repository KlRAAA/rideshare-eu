import type { MetadataRoute } from 'next';

// Makes the site installable ("Add to Home Screen"), which iPhones require
// before they allow phone notifications (sub-project F).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RideShareEU',
    short_name: 'RideShareEU',
    description: 'Campus carpooling for the MSEUF community',
    start_url: '/auth/dashboard',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#800000',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
