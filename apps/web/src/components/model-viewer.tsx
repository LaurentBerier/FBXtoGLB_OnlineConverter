'use client';

import * as React from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Bounds, useGLTF, useFBX, Center } from '@react-three/drei';
import { Box, Grid3x3, RotateCw, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewerFormat = 'glb' | 'fbx';

/** Apply/clear wireframe on every material in a subtree. */
function setWireframe(root: THREE.Object3D, on: boolean) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m && 'wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = on;
    }
  });
}

function GlbModel({ src, wireframe }: { src: string; wireframe: boolean }) {
  // Second arg enables the Draco decoder so compressed GLBs load too.
  const { scene } = useGLTF(src, true);
  React.useEffect(() => setWireframe(scene, wireframe), [scene, wireframe]);
  return <primitive object={scene} />;
}

function FbxModel({ src, wireframe }: { src: string; wireframe: boolean }) {
  const group = useFBX(src);
  React.useEffect(() => setWireframe(group, wireframe), [group, wireframe]);
  // FBX scenes are often authored in cm — scale down so framing behaves.
  return <primitive object={group} scale={0.01} />;
}

class ViewerErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

interface ModelViewerProps {
  src: string | null;
  format: ViewerFormat;
  /** Optional label shown in the top-left (e.g. "Result"). */
  label?: string;
  className?: string;
}

export default function ModelViewer({ src, format, label, className }: ModelViewerProps) {
  const [wireframe, setWire] = React.useState(false);
  const [autoRotate, setAutoRotate] = React.useState(true);
  const [grid, setGrid] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  // Reset error state when the source changes.
  React.useEffect(() => setFailed(false), [src]);

  if (!src) return null;

  return (
    <div className={cn('relative h-72 w-full overflow-hidden rounded-xl border border-border bg-[#fafafa]', className)}>
      {label && (
        <span className="absolute left-3 top-3 z-10 rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium text-muted-foreground backdrop-blur">
          {label}
        </span>
      )}

      {failed ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span>Preview unavailable for this file.</span>
          <span className="text-xs">The conversion still works — download to inspect.</span>
        </div>
      ) : (
        <>
          <React.Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            }
          >
            <Canvas camera={{ position: [2.5, 2, 3.5], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true }}>
              <hemisphereLight intensity={0.8} groundColor={new THREE.Color('#d0d0d0')} />
              <directionalLight position={[5, 8, 5]} intensity={1.6} castShadow />
              <directionalLight position={[-5, 3, -5]} intensity={0.5} />

              <ViewerErrorBoundary onError={() => setFailed(true)}>
                <Bounds fit clip observe margin={1.2}>
                  <Center>
                    {format === 'glb' ? (
                      <GlbModel src={src} wireframe={wireframe} />
                    ) : (
                      <FbxModel src={src} wireframe={wireframe} />
                    )}
                  </Center>
                </Bounds>
              </ViewerErrorBoundary>

              {grid && (
                <Grid
                  args={[20, 20]}
                  cellSize={0.5}
                  cellThickness={0.5}
                  cellColor="#e2e2e2"
                  sectionSize={2.5}
                  sectionThickness={1}
                  sectionColor="#cfcfcf"
                  fadeDistance={28}
                  fadeStrength={1.2}
                  position={[0, -0.01, 0]}
                  infiniteGrid
                />
              )}

              <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={1.2} enablePan />
            </Canvas>
          </React.Suspense>

          {/* Controls overlay */}
          <div className="absolute bottom-3 right-3 z-10 flex gap-1.5">
            <ViewerToggle active={autoRotate} onClick={() => setAutoRotate((v) => !v)} title="Auto-rotate">
              <RotateCw className="h-4 w-4" />
            </ViewerToggle>
            <ViewerToggle active={wireframe} onClick={() => setWire((v) => !v)} title="Wireframe">
              <Box className="h-4 w-4" />
            </ViewerToggle>
            <ViewerToggle active={grid} onClick={() => setGrid((v) => !v)} title="Grid">
              <Grid3x3 className="h-4 w-4" />
            </ViewerToggle>
          </div>
        </>
      )}
    </div>
  );
}

function ViewerToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md border backdrop-blur transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background/80 text-muted-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}
