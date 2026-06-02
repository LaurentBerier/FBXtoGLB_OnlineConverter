import { Boxes, Bone, Film, Palette, ImageIcon, ShieldCheck } from 'lucide-react';
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
    <main className="min-h-screen bg-background">
      <div className="container py-12 sm:py-16">
        {/* Header */}
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="flex h-2 w-2 rounded-full bg-success" />
            High-fidelity rig &amp; animation preservation
          </div>
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Boxes className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">FBX ⇄ GLB Converter</h1>
          </div>
          <p className="text-balance text-muted-foreground sm:text-lg">
            Convert rigged characters between FBX and GLB while keeping skeletons, skinning,
            animation clips, PBR materials and textures intact.
          </p>
        </header>

        {/* Converter */}
        <div className="mx-auto max-w-2xl">
          <Converter />
        </div>

        {/* Feature grid */}
        <section className="mx-auto mt-14 max-w-4xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <f.icon className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mx-auto mt-16 max-w-2xl text-center text-xs text-muted-foreground">
          Files are processed temporarily and auto-deleted. Powered by FBX2glTF &amp; Blender.
        </footer>
      </div>
    </main>
  );
}
