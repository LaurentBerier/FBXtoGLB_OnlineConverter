import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FBX ⇄ GLB Converter — high-fidelity 3D conversion',
  description:
    'Convert between FBX and GLB in your browser while preserving skeletons, skinning, animations, PBR materials and textures.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
