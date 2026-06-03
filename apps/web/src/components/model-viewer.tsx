'use client';

import * as React from 'react';
import * as THREE from 'three';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  Environment,
  ContactShadows,
  GizmoHelper,
  GizmoViewport,
  useGLTF,
  useAnimations,
} from '@react-three/drei';
import { FBXLoader, TGALoader } from 'three-stdlib';
import {
  Box,
  Grid3x3,
  RotateCw,
  Loader2,
  AlertTriangle,
  Play,
  Pause,
  Bone,
  Maximize2,
  Minimize2,
  Rotate3d,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UpAxis } from '@/lib/fbx-axis';

export type ViewerFormat = 'glb' | 'fbx';

const TARGET_SIZE = 2; // models are normalized so their largest dimension = 2 units

interface Measure {
  halfHeight: number;
}

interface ReadyInfo {
  hasAnim: boolean;
  hasSkeleton: boolean;
  measure: Measure;
  /** Geometry-inferred up-axis, when unambiguous (FBX only). */
  suggestedUpAxis?: UpAxis;
}

interface ModelProps {
  src: string;
  wireframe: boolean;
  playing: boolean;
  /** Overlay the rig's bones (skinned meshes only). */
  skeleton: boolean;
  /** Rotate Z-up content upright to Y-up for display. */
  zUp: boolean;
  onReady: (info: ReadyInfo) => void;
}

/**
 * Bone overlay for skinned meshes. SkeletonHelper reads the bones' world
 * matrices each frame, so it tracks the normalized transform and animation
 * automatically. depthTest is disabled so the rig stays visible through the mesh.
 */
function SkeletonOverlay({ object }: { object: THREE.Object3D }) {
  const helper = React.useMemo(() => {
    const h = new THREE.SkeletonHelper(object);
    const mat = h.material as THREE.LineBasicMaterial;
    mat.depthTest = false;
    mat.transparent = true;
    mat.opacity = 0.9;
    h.renderOrder = 999;
    h.frustumCulled = false;
    return h;
  }, [object]);
  React.useEffect(() => () => helper.geometry.dispose(), [helper]);
  return <primitive object={helper} />;
}

function detectSkeleton(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) found = true;
  });
  return found;
}

function setWireframe(root: THREE.Object3D, on: boolean) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) if (m && 'wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = on;
  });
}

function neutralMaterial(): THREE.MeshStandardMaterial {
  // Matches the 3D GLB Painter's untextured clay proxy.
  return new THREE.MeshStandardMaterial({ color: new THREE.Color('#8f8f8f'), roughness: 0.9, metalness: 0 });
}

function textureDecoded(map: THREE.Texture | null | undefined): boolean {
  const img = map?.image as { width?: number; videoWidth?: number } | undefined;
  return !!(map && img && (img.width || img.videoWidth));
}

function hasValidMap(mat: THREE.Material | undefined): boolean {
  return textureDecoded((mat as THREE.MeshStandardMaterial)?.map);
}

// Converted PBR materials are cached per source so repeated preview passes
// (textures decode asynchronously) reuse the same instance instead of leaking.
const standardCache = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>();

/**
 * Promote a textured source material to MeshStandardMaterial so it responds to
 * the HDRI environment (IBL). FBXLoader emits MeshPhongMaterial, which three's
 * `scene.environment` does NOT light — that left textured FBX models rendering
 * near-black under the studio IBL. GLB materials are already Standard and pass
 * through untouched.
 */
function toStandard(src: THREE.Material): THREE.MeshStandardMaterial {
  if (src instanceof THREE.MeshStandardMaterial) return src;
  let std = standardCache.get(src);
  if (!std) {
    std = new THREE.MeshStandardMaterial();
    standardCache.set(src, std);
  }
  const s = src as THREE.MeshPhongMaterial;
  std.map = s.map ?? null;
  if (s.color) std.color.copy(s.color);
  // A black diffuse factor would multiply the base-colour texture to black;
  // when a map is present, neutralise the tint so the texture shows through.
  if (std.map && std.color.r + std.color.g + std.color.b < 0.05) std.color.setScalar(1);
  std.normalMap = textureDecoded(s.normalMap) ? s.normalMap : null;
  if (s.normalScale) std.normalScale.copy(s.normalScale);
  if (s.emissive) std.emissive.copy(s.emissive);
  std.emissiveMap = s.emissiveMap ?? null;
  std.aoMap = s.aoMap ?? null;
  std.alphaMap = s.alphaMap ?? null;
  std.transparent = s.transparent ?? false;
  std.opacity = s.opacity ?? 1;
  std.side = s.side ?? THREE.FrontSide;
  std.vertexColors = s.vertexColors ?? false;
  // Moderate gloss so the form reads under the studio key — fully matte looked flat.
  std.roughness = 0.55;
  std.metalness = 0;
  std.envMapIntensity = 1.1;
  std.needsUpdate = true;
  return std;
}

/**
 * Show textures when they actually decoded (promoted to a PBR material so the
 * HDRI lights them), otherwise swap in a neutral clay material so untextured
 * models — or FBX with missing/external textures — stay visible. Originals are
 * remembered so a later pass can restore textures that finish loading. Also
 * disables frustum culling, which skinned meshes get wrong (their rest-pose
 * bounds mislead the culler).
 */
function applyPreviewMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh & { userData: { __orig?: THREE.Material | THREE.Material[] } };
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    if (mesh.userData.__orig === undefined) mesh.userData.__orig = mesh.material;
    const orig = mesh.userData.__orig;
    const pick = (m: THREE.Material) => (hasValidMap(m) ? toStandard(m) : neutralMaterial());
    mesh.material = Array.isArray(orig) ? orig.map(pick) : pick(orig);
  });
}

/** Rest-pose bounding box from geometry — skinned meshes mislead setFromObject. */
function geometryBox(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    if (m.geometry.boundingBox) {
      tmp.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
      box.union(tmp);
    }
  });
  return box;
}

interface Prepared {
  measure: Measure;
  /**
   * Up-axis inferred from the raw geometry's proportions, when unambiguous.
   * FBX axis *metadata* is unreliable (the loader ignores it and exporters
   * disagree), so a clearly elongated model is a stronger signal: a humanoid
   * standing along Z is lying down when shown Y-up. `undefined` = inconclusive,
   * keep the metadata guess.
   */
  suggested?: UpAxis;
}

/** Infer up-axis from raw (unrotated) extents; only commit when one axis clearly dominates. */
function suggestUpAxis(group: THREE.Object3D): UpAxis | undefined {
  const box = geometryBox(group);
  if (box.isEmpty()) return undefined;
  const s = new THREE.Vector3();
  box.getSize(s);
  if (s.z > s.y * 1.5 && s.z > s.x * 1.1) return 'z'; // tall along Z → Z-up
  if (s.y > s.z * 1.5 && s.y > s.x * 1.1) return 'y'; // tall along Y → Y-up
  return undefined;
}

/** Upright (Z-up→Y-up), normalize size to TARGET_SIZE, and center at origin. */
function normalizeAndCenter(group: THREE.Object3D, zUp: boolean, detectOrient: boolean): Prepared {
  group.rotation.set(0, 0, 0);
  group.scale.setScalar(1);
  group.position.set(0, 0, 0);

  // Measure orientation from raw coordinates before any uprighting rotation.
  const suggested = detectOrient ? suggestUpAxis(group) : undefined;

  group.rotation.set(zUp ? -Math.PI / 2 : 0, 0, 0);
  const box = geometryBox(group);
  if (box.isEmpty()) return { measure: { halfHeight: TARGET_SIZE / 2 }, suggested };
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = TARGET_SIZE / maxDim;
  group.scale.setScalar(s);
  group.position.copy(center).multiplyScalar(-s);
  return { measure: { halfHeight: (size.y * s) / 2 || TARGET_SIZE / 2 }, suggested };
}

function useClipPlayback(
  object: THREE.Object3D,
  clips: THREE.AnimationClip[] | undefined,
  playing: boolean,
) {
  const { actions, names } = useAnimations(clips ?? [], object);
  React.useEffect(() => {
    const action = names.length ? actions[names[0]] : null;
    if (!action) return;
    if (playing) {
      action.paused = false;
      action.reset().play();
    } else {
      action.paused = true;
    }
    return () => {
      action.paused = true;
    };
  }, [playing, actions, names]);
  return names.length > 0;
}

/** Normalize + frame + material setup once the model mounts. */
function usePrepareModel(
  obj: THREE.Object3D | null,
  deps: React.DependencyList,
  zUp: boolean,
  onReady: ModelProps['onReady'],
  hasAnim: boolean,
  detectOrient: boolean,
) {
  React.useEffect(() => {
    if (!obj) return;
    const { measure, suggested } = normalizeAndCenter(obj, zUp, detectOrient);
    applyPreviewMaterials(obj);
    onReady({ hasAnim, hasSkeleton: detectSkeleton(obj), measure, suggestedUpAxis: suggested });
    // Re-evaluate materials after textures have had a chance to decode.
    const t = setTimeout(() => applyPreviewMaterials(obj), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function GlbModel({ src, wireframe, playing, skeleton, zUp, onReady }: ModelProps) {
  const { scene, animations } = useGLTF(src, true);
  const hasAnim = useClipPlayback(scene, animations, playing);
  React.useEffect(() => setWireframe(scene, wireframe), [scene, wireframe]);
  usePrepareModel(scene, [scene, hasAnim, zUp], zUp, onReady, hasAnim, false);
  return (
    <>
      <primitive object={scene} />
      {skeleton && <SkeletonOverlay object={scene} />}
    </>
  );
}

function FbxModel({ src, wireframe, playing, skeleton, zUp, onReady }: ModelProps) {
  const group = useLoader(FBXLoader, src, (loader) => {
    // Register a TGA handler so .tga textures (common in FBX) can load; missing
    // external textures fall back to the neutral clay material above.
    (loader as FBXLoader).manager.addHandler(/\.tga$/i, new TGALoader());
  }) as unknown as THREE.Group;

  const hasAnim = useClipPlayback(group, group.animations, playing);
  React.useEffect(() => setWireframe(group, wireframe), [group, wireframe]);
  usePrepareModel(group, [group, hasAnim, zUp], zUp, onReady, hasAnim, true);
  return (
    <>
      <primitive object={group} />
      {skeleton && <SkeletonOverlay object={group} />}
    </>
  );
}

/**
 * Real HDRI-based IBL, mirroring the lighting of the 3D GLB Painter app
 * ("citrusOrchard" preset): a warm soft-daylight environment that drives PBR
 * shading and reflections. Loaded locally — no CDN. We only use it for lighting,
 * not as the visible background, so the app's dark studio backdrop is preserved.
 */
function StudioEnvironment() {
  return <Environment files="/hdr/citrus_orchard_puresky_1k.hdr" environmentIntensity={1.4} resolution={512} />;
}

// Reused per-frame to avoid allocations in the render loop.
const _keyPos = new THREE.Vector3();
const _camRight = new THREE.Vector3();

/**
 * Key light that tracks the camera: positioned up-and-right of the current view
 * and aimed at the origin, so the side the user is looking at is always lit —
 * never the back — no matter how the model is oriented or orbited.
 */
function CameraKeyLight({ intensity = 2.4 }: { intensity?: number }) {
  const ref = React.useRef<THREE.DirectionalLight>(null);
  useFrame(({ camera }) => {
    const light = ref.current;
    if (!light) return;
    _camRight.setFromMatrixColumn(camera.matrixWorld, 0); // camera's right axis
    _keyPos.copy(camera.position).addScaledVector(_camRight, 1.6);
    _keyPos.y += 2.2;
    light.position.copy(_keyPos);
    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld();
  });
  return <directionalLight ref={ref} intensity={intensity} color="#fff4e6" />;
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
  label?: string;
  /** Source up-axis; when 'z' the model is rotated upright for display. */
  sourceUpAxis?: UpAxis;
  className?: string;
}

export default function ModelViewer({ src, format, label, sourceUpAxis, className }: ModelViewerProps) {
  const [wireframe, setWire] = React.useState(false);
  const [autoRotate, setAutoRotate] = React.useState(false);
  const [grid, setGrid] = React.useState(true);
  const [skeleton, setSkeleton] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [hasAnim, setHasAnim] = React.useState(false);
  const [hasSkeleton, setHasSkeleton] = React.useState(false);
  const [measure, setMeasure] = React.useState<Measure>({ halfHeight: 1 });
  const [failed, setFailed] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  // Manual up-axis override. null = follow auto-detect (geometry suggestion, else metadata).
  const [axisOverride, setAxisOverride] = React.useState<UpAxis | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setFailed(false);
    setPlaying(false);
    setHasAnim(false);
    setHasSkeleton(false);
    setSkeleton(false);
    setAxisOverride(null);
  }, [src]);

  // Track native fullscreen state so the toggle icon stays in sync (incl. Esc).
  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  const onReady = React.useCallback((info: ReadyInfo) => {
    setHasAnim(info.hasAnim);
    setHasSkeleton(info.hasSkeleton);
    setMeasure(info.measure);
    // Auto-correct orientation from the geometry hint, but never override a
    // manual choice the user has already made (functional update keeps it).
    if (info.suggestedUpAxis) setAxisOverride((prev) => prev ?? info.suggestedUpAxis ?? null);
  }, []);

  if (!src) return null;

  const effectiveAxis: UpAxis = axisOverride ?? (sourceUpAxis === 'z' ? 'z' : 'y');
  const zUp = effectiveAxis === 'z';
  const groundY = -measure.halfHeight;

  return (
    <div
      ref={containerRef}
      className={cn(
        'viewer-backdrop relative w-full overflow-hidden rounded-xl border border-border',
        // In native fullscreen the UA sizes the element to the screen; otherwise fixed height.
        isFullscreen ? 'h-full rounded-none border-0' : 'h-80',
        className,
      )}
    >
      {label && (
        <span className="absolute left-3 top-3 z-10 rounded-md border border-border/60 bg-background/70 px-2 py-0.5 text-xs font-medium text-muted-foreground backdrop-blur">
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
            <Canvas
              shadows
              dpr={[1, 2]}
              camera={{ position: [2.6, 1.8, 3.4], fov: 42, near: 0.01, far: 5000 }}
              gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
            >
              {/* Studio 3-point rig: a key that follows the camera (so the
                  visible side is always lit), a cool fill to open shadows, and a
                  back rim for separation. The HDRI adds soft ambient + reflections. */}
              <hemisphereLight args={['#ffe9d2', '#3a4663', 0.5]} />
              <CameraKeyLight intensity={2.4} />
              <directionalLight color="#bcd3ff" position={[-5, 2.5, 3]} intensity={0.55} />
              <directionalLight color="#ffffff" position={[-1.5, 5, -6]} intensity={1.3} />
              <StudioEnvironment />

              <ViewerErrorBoundary onError={() => setFailed(true)}>
                {format === 'glb' ? (
                  <GlbModel src={src} wireframe={wireframe} playing={playing} skeleton={skeleton} zUp={zUp} onReady={onReady} />
                ) : (
                  <FbxModel src={src} wireframe={wireframe} playing={playing} skeleton={skeleton} zUp={zUp} onReady={onReady} />
                )}
              </ViewerErrorBoundary>

              <ContactShadows position={[0, groundY, 0]} scale={6} far={4} blur={2.6} opacity={0.45} resolution={1024} />

              {grid && (
                <Grid
                  position={[0, groundY, 0]}
                  args={[30, 30]}
                  cellSize={0.5}
                  cellThickness={0.5}
                  cellColor="#5a5a5a"
                  sectionSize={2.5}
                  sectionThickness={1}
                  sectionColor="#7c3aed"
                  fadeDistance={30}
                  fadeStrength={1.4}
                  infiniteGrid
                />
              )}

              <OrbitControls
                makeDefault
                target={[0, 0, 0]}
                autoRotate={autoRotate}
                autoRotateSpeed={1.1}
                enablePan
                enableZoom
                zoomSpeed={1.1}
                minDistance={0.05}
                maxDistance={2000}
                enableDamping
                dampingFactor={0.08}
              />

              {/* World-axis gizmo (Y is up) — click an axis to snap the view. */}
              <GizmoHelper alignment="bottom-left" margin={[64, 72]}>
                <GizmoViewport
                  axisColors={['#ff4d6d', '#52c41a', '#4d94ff']}
                  labelColor="#0b0b0f"
                  hideNegativeAxes
                />
              </GizmoHelper>
            </Canvas>
          </React.Suspense>

          {/* Controls overlay */}
          <div className="absolute bottom-3 right-3 z-10 flex gap-1.5">
            {hasAnim && (
              <ViewerToggle
                active={playing}
                onClick={() => setPlaying((v) => !v)}
                title={playing ? 'Pause' : 'Play animation'}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </ViewerToggle>
            )}
            {format === 'fbx' && (
              <ViewerToggle
                active={zUp}
                onClick={() => setAxisOverride(effectiveAxis === 'z' ? 'y' : 'z')}
                title={`Up axis: ${zUp ? 'Z' : 'Y'} — click to flip if the model looks tipped over`}
              >
                <Rotate3d className="h-4 w-4" />
              </ViewerToggle>
            )}
            {hasSkeleton && (
              <ViewerToggle
                active={skeleton}
                onClick={() => setSkeleton((v) => !v)}
                title={skeleton ? 'Hide skeleton' : 'Show skeleton'}
              >
                <Bone className="h-4 w-4" />
              </ViewerToggle>
            )}
            <ViewerToggle active={autoRotate} onClick={() => setAutoRotate((v) => !v)} title="Auto-rotate">
              <RotateCw className="h-4 w-4" />
            </ViewerToggle>
            <ViewerToggle active={wireframe} onClick={() => setWire((v) => !v)} title="Wireframe">
              <Box className="h-4 w-4" />
            </ViewerToggle>
            <ViewerToggle active={grid} onClick={() => setGrid((v) => !v)} title="Grid">
              <Grid3x3 className="h-4 w-4" />
            </ViewerToggle>
            <ViewerToggle
              active={isFullscreen}
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </ViewerToggle>
          </div>

          {hasAnim && (
            <span className="absolute bottom-3 left-3 z-10 rounded-md border border-border/60 bg-background/70 px-2 py-0.5 text-xs font-medium text-muted-foreground backdrop-blur">
              {playing ? 'Playing animation' : 'Animation available'}
            </span>
          )}
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
          : 'border-border/60 bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
