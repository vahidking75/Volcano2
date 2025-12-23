import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import SwRegister from './SwRegister';

export const metadata: Metadata = {
  title: 'Volcano: Virtuoso Image Generation Assistance',
  description: 'An online, mobile-friendly prompt creation studio with vocabulary intelligence and model-aware formatting.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/icon-180.png', sizes: '180x180', type: 'image/png' }]
  }
};

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
