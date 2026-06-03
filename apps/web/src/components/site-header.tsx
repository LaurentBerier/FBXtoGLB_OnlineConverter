'use client';

import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Theme-swapped wordmark: violet on light, white on dark. */}
          <Image
            src="/Sandscape_Logo_Violet_RGB.png"
            alt="Sandscape"
            width={150}
            height={32}
            priority
            className="h-7 w-auto dark:hidden"
          />
          <Image
            src="/Sandscape_Logo_White.png"
            alt="Sandscape"
            width={150}
            height={32}
            priority
            className="hidden h-7 w-auto dark:block"
          />
          <span className="hidden items-center sm:inline-flex">
            <span className="mx-2 h-5 w-px bg-border" />
            <span className="text-sm font-medium text-muted-foreground">3D Converter</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://sandscape.app"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sandscape ↗
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
