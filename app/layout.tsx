import '@fontsource-variable/inter';
import './folio.css';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#15141d',
};

const title = 'Folio — Sua estante de inglês';
const description = 'Leia livros em inglês nos formatos EPUB e TXT, traduza trechos no contexto e guarde seu vocabulário para revisar com flashcards.';
const siteUrl = process.env.FOLIO_SITE_URL;
const shareImage = siteUrl ? new URL('/folio-social.png', siteUrl).href : undefined;

export const metadata: Metadata = {
  title: { default: title, template: '%s — Folio' },
  description,
  applicationName: 'Folio',
  category: 'Educação',
  icons: { icon: [{ url: '/folio-mark.svg', type: 'image/svg+xml', sizes: 'any' }] },
  openGraph: { type: 'website', locale: 'pt_BR', siteName: 'Folio', title, description,
    ...(shareImage && { images: [{ url: shareImage, width: 1200, height: 630, alt: 'Folio — Sua estante de inglês' }] }) },
  twitter: { card: shareImage ? 'summary_large_image' : 'summary', title, description,
    ...(shareImage && { images: [shareImage] }) },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Chromium on iOS can add an Autofill frame token to this element before React hydrates.
  return <html lang="pt-BR" suppressHydrationWarning><body>{children}</body></html>;
}
