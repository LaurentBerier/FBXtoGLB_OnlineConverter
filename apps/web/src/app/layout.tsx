import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sandscape · 3D Converter — FBX ⇄ GLB',
  description:
    'A Sandscape tool: convert between FBX and GLB in your browser while preserving skeletons, skinning, animations, PBR materials and textures. Preview, optimize and download.',
  applicationName: 'Sandscape 3D Converter',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'Sandscape · 3D Converter — FBX ⇄ GLB',
    description:
      'High-fidelity FBX ⇄ GLB conversion with in-browser 3D preview and optimization. A Sandscape tool.',
    siteName: 'Sandscape',
    images: [{ url: '/Sandscape_Logo_Degrade_RGB.png', width: 1200, height: 630, alt: 'Sandscape' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sandscape · 3D Converter — FBX ⇄ GLB',
    description: 'High-fidelity FBX ⇄ GLB conversion with in-browser 3D preview. A Sandscape tool.',
    images: ['/Sandscape_Logo_Degrade_RGB.png'],
  },
  metadataBase: new URL('http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
