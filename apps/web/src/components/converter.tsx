'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Download, Loader2, RefreshCw, Wand2, AlertCircle, Minimize2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dropzone } from '@/components/dropzone';
import { FormatSelector } from '@/components/format-selector';
import { OptionsPanel } from '@/components/options-panel';
import { ReportCard } from '@/components/report-card';
import { cn, formatBytes } from '@/lib/utils';
import { detectFbxUpAxis, type UpAxis } from '@/lib/fbx-axis';
import {
  fetchCapabilities,
  fetchJob,
  startConversion,
  downloadUrl,
  DEFAULT_OPTIONS,
  type Capabilities,
  type Direction,
  type JobView,
  type OptimizeOptions,
  type OutputUpAxis,
} from '@/lib/api';

// Three.js viewer is client-only (no SSR) and lazy-loaded to keep the page light.
const ModelViewer = dynamic(() => import('@/components/model-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-xl border border-border bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

function extFormat(name: string): 'glb' | 'fbx' {
  return name.toLowerCase().endsWith('.fbx') ? 'fbx' : 'glb';
}

type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const DEFAULT_CAPS: Capabilities = {
  limits: { maxFileSizeMb: 500, retentionHours: 24 },
  queue: { running: 0, depth: 0 },
  engines: { fbx2gltf: { available: true, version: null }, blender: { available: true, version: null } },
  directions: { fbx2glb: true, glb2fbx: true },
};

function directionForFile(name: string): Direction {
  return name.toLowerCase().endsWith('.fbx') ? 'fbx2glb' : 'glb2fbx';
}

export function Converter() {
  const [caps, setCaps] = React.useState<Capabilities>(DEFAULT_CAPS);
  const [file, setFile] = React.useState<File | null>(null);
  const [direction, setDirection] = React.useState<Direction>('fbx2glb');
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [uploadPct, setUploadPct] = React.useState(0);
  const [job, setJob] = React.useState<JobView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [options, setOptions] = React.useState<OptimizeOptions>(DEFAULT_OPTIONS);
  const [inputUrl, setInputUrl] = React.useState<string | null>(null);
  const [inputUpAxis, setInputUpAxis] = React.useState<UpAxis>('unknown');
  const [outputUpAxis, setOutputUpAxis] = React.useState<OutputUpAxis>('y');
  // The axis the *current* job was actually converted with. Snapshotted at
  // convert time so toggling `outputUpAxis` afterwards can't re-rotate (and tip
  // over) the already-built result preview.
  const [convertedUpAxis, setConvertedUpAxis] = React.useState<OutputUpAxis>('y');
  const pollRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build an object URL for the local file so we can preview it before converting.
  React.useEffect(() => {
    if (!file) {
      setInputUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setInputUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Detect the up-axis of the chosen file (GLB/glTF is always Y-up) and match
  // the output orientation to it, so the converted file keeps its orientation
  // by default. The user can still override via the toggle afterwards.
  React.useEffect(() => {
    if (!file) {
      setInputUpAxis('unknown');
      return;
    }
    let cancelled = false;
    if (file.name.toLowerCase().endsWith('.fbx')) {
      detectFbxUpAxis(file)
        .then((axis) => {
          if (cancelled) return;
          setInputUpAxis(axis);
          if (axis !== 'unknown') setOutputUpAxis(axis);
        })
        .catch(() => !cancelled && setInputUpAxis('unknown'));
    } else {
      setInputUpAxis('y');
      setOutputUpAxis('y');
    }
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Load server capabilities (engine availability, limits).
  React.useEffect(() => {
    fetchCapabilities()
      .then(setCaps)
      .catch(() => setCaps(DEFAULT_CAPS));
  }, []);

  // Keep direction in sync with the chosen file.
  React.useEffect(() => {
    if (file) setDirection(directionForFile(file.name));
  }, [file]);

  React.useEffect(() => () => clearTimeout(pollRef.current ?? undefined), []);

  const busy = phase === 'uploading' || phase === 'processing';

  const poll = React.useCallback((id: string) => {
    const tick = async () => {
      try {
        const next = await fetchJob(id);
        setJob(next);
        if (next.status === 'done') {
          setPhase('done');
          return;
        }
        if (next.status === 'error') {
          setError(next.error || 'Conversion failed.');
          setPhase('error');
          return;
        }
        pollRef.current = setTimeout(tick, 900);
      } catch (e) {
        setError((e as Error).message);
        setPhase('error');
      }
    };
    void tick();
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    setError(null);
    setJob(null);
    setUploadPct(0);
    setPhase('uploading');
    try {
      const created = await startConversion(file, direction, options, outputUpAxis, setUploadPct);
      setConvertedUpAxis(outputUpAxis);
      setJob(created);
      setPhase('processing');
      poll(created.id);
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  };

  const reset = () => {
    clearTimeout(pollRef.current ?? undefined);
    setFile(null);
    setJob(null);
    setError(null);
    setUploadPct(0);
    setPhase('idle');
  };

  const progressValue =
    phase === 'uploading' ? Math.round(uploadPct * 0.25) : job ? Math.max(25, job.progress.percent) : 0;
  const progressLabel =
    phase === 'uploading' ? `Uploading… ${uploadPct}%` : job?.progress.label || 'Working…';

  return (
    <Card className="border-border/70 bg-card/80 shadow-brand backdrop-blur-xl">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <Dropzone
          file={file}
          onFile={setFile}
          maxSizeMb={caps.limits.maxFileSizeMb}
          disabled={busy}
        />

        {/* Preview the chosen file before conversion. */}
        {file && inputUrl && phase !== 'done' && (
          <div className="space-y-2">
            <ModelViewer
              src={inputUrl}
              format={extFormat(file.name)}
              sourceUpAxis={inputUpAxis}
              label="Input preview"
            />
            {inputUpAxis !== 'unknown' && (
              <p className="text-xs text-muted-foreground">
                Detected{' '}
                <span className="font-medium text-foreground">
                  {inputUpAxis === 'z' ? 'Z-up' : 'Y-up'}
                </span>{' '}
                orientation
                {inputUpAxis === 'z' && ' — shown upright (rotated to Y-up) in the preview'}.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Conversion</label>
            {(!caps.directions.fbx2glb || !caps.directions.glb2fbx) && (
              <span className="text-xs text-amber-600">Some engines are offline</span>
            )}
          </div>
          <FormatSelector
            value={direction}
            onChange={setDirection}
            available={caps.directions}
            disabled={busy}
          />
        </div>

        {/* Output orientation */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Output orientation</p>
            <p className="text-xs text-muted-foreground">
              {direction === 'fbx2glb' ? 'Y-up is the glTF standard' : 'Z-up suits Unreal / 3ds Max'}
            </p>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {(['y', 'z'] as OutputUpAxis[]).map((ax) => (
              <button
                key={ax}
                type="button"
                disabled={busy}
                onClick={() => setOutputUpAxis(ax)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                  outputUpAxis === ax
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-accent',
                )}
              >
                {ax === 'y' ? 'Y-up' : 'Z-up'}
              </button>
            ))}
          </div>
        </div>

        <OptionsPanel
          value={options}
          onChange={setOptions}
          enabled={direction === 'fbx2glb'}
          disabled={busy}
        />

        {(busy || phase === 'done') && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {progressLabel}
              </span>
              <span className="tabular-nums text-muted-foreground">{progressValue}%</span>
            </div>
            <Progress value={progressValue} indeterminate={busy && progressValue < 30} />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive animate-fade-in">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Result preview + report */}
        {phase === 'done' && job && (
          <div className="space-y-4 animate-fade-in">
            <ModelViewer
              src={downloadUrl(job.id)}
              format={job.direction === 'fbx2glb' ? 'glb' : 'fbx'}
              // GLB output is Y-up; an FBX exported Z-up is shown upright. Use the
              // axis the job was built with, not the live toggle (which the user
              // may have changed since), so the preview can't tip over.
              sourceUpAxis={job.direction === 'glb2fbx' ? convertedUpAxis : 'y'}
              label="Result"
            />
            {job.compression && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
                <Minimize2 className="h-4 w-4 text-success" />
                <span className="text-muted-foreground">
                  Compressed{' '}
                  <span className="font-medium text-foreground">
                    {formatBytes(job.compression.beforeBytes)}
                  </span>{' '}
                  →{' '}
                  <span className="font-medium text-foreground">
                    {formatBytes(job.compression.afterBytes)}
                  </span>{' '}
                  <span className="font-semibold text-success">
                    (−
                    {Math.max(
                      0,
                      Math.round((1 - job.compression.afterBytes / job.compression.beforeBytes) * 100),
                    )}
                    %)
                  </span>
                </span>
              </div>
            )}
            {job.report && <ReportCard report={job.report} />}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          {phase !== 'done' ? (
            <Button
              size="lg"
              variant="brand"
              className="flex-1"
              disabled={!file || busy || !caps.directions[direction]}
              onClick={handleConvert}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {busy ? 'Converting…' : 'Convert'}
            </Button>
          ) : (
            <>
              <a
                href={job ? downloadUrl(job.id) : '#'}
                download
                className={cn(buttonVariants({ variant: 'brand', size: 'lg' }), 'min-w-0 flex-1')}
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Download {job?.outputName}
                  {job?.outputSize ? (
                    <span className="opacity-70"> ({formatBytes(job.outputSize)})</span>
                  ) : null}
                </span>
              </a>
              <Button size="lg" variant="outline" className="shrink-0" onClick={reset}>
                <RefreshCw className="h-4 w-4" />
                Convert another
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
