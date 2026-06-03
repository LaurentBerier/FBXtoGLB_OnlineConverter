import Image from 'next/image';
import { Boxes, Bone, Film, Palette, ImageIcon, ShieldCheck } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { Converter } from '@/components/converter';

const FEATURES = [
  { icon: Boxes, title: 'Geometry & hierarchy', desc: 'Meshes, transforms and pivots preserved.' },
  { icon: Bone, title: 'Skeletons & skinning', desc: 'Bones, joints, skin weights and bind poses.' },
  { icon: Film, title: 'Animations', desc: 'Multiple clips, keyframes and root motion.' },
  { icon: Palette, title: 'PBR materials', desc: 'Base color, metallic, roughness, normals.' },
  { icon: ImageIcon, title: 'Textures', desc: 'Embedded and external PNG / JPG textures.' },
  { icon: ShieldCheck, title: 'Validated', desc: 'Every conversion ships a fidelity report.' },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decorative brand blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-[-6rem] h-80 w-80 animate-blob rounded-full bg-primary/15 blur-[110px]" />
        <div className="absolute right-[-6rem] top-40 h-96 w-96 animate-blob rounded-full bg-fuchsia-500/10 blur-[120px] [animation-delay:4s]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 animate-blob rounded-full bg-sky-500/10 blur-[120px] [animation-delay:8s]" />
      </div>

      <SiteHeader />

      <main className="container pb-20 pt-12 sm:pt-16">
        {/* Hero */}
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="flex h-2 w-2 rounded-full bg-primary" />
            High-fidelity rig &amp; animation preservation
          </div>
          <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="text-gradient-brand">FBX ⇄ GLB</span> Converter
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground sm:text-lg">
            Convert rigged characters between FBX and GLB while keeping skeletons, skinning, animation
            clips, PBR materials and textures intact — then preview and optimize in the browser.
          </p>
        </header>

        {/* Converter */}
        <div className="mx-auto max-w-2xl">
          <Converter />
        </div>

        {/* Feature grid */}
        <section className="mx-auto mt-16 max-w-4xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card/70 p-4 backdrop-blur transition-colors hover:border-primary/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mx-auto mt-16 flex max-w-2xl flex-col items-center gap-3 text-center text-xs text-muted-foreground">
          {/* Sandscape brand lockup (theme-swapped) */}
          <a
            href="https://sandscape.app"
            target="_blank"
            rel="noreferrer"
            className="opacity-80 transition-opacity hover:opacity-100"
            aria-label="Sandscape"
          >
            <Image
              src="/Sandscape_Logo_Violet_RGB.png"
              alt="Sandscape"
              width={140}
              height={30}
              className="h-6 w-auto dark:hidden"
            />
            <Image
              src="/Sandscape_Logo_White.png"
              alt="Sandscape"
              width={140}
              height={30}
              className="hidden h-6 w-auto dark:block"
            />
          </a>
          <div className="space-y-1">
            <p>Files are processed temporarily and auto-deleted. Powered by FBX2glTF &amp; Blender.</p>
            <p>A Sandscape tool · part of the Sandscape ecosystem</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
