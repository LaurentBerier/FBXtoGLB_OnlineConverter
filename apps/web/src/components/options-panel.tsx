'use client';

import * as React from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OptimizeOptions, TextureFormat } from '@/lib/api';

interface OptionsPanelProps {
  value: OptimizeOptions;
  onChange: (next: OptimizeOptions) => void;
  /** Optimization only applies to GLB output. */
  enabled: boolean;
  disabled?: boolean;
}

const TEXTURE_FORMATS: { id: TextureFormat; label: string }[] = [
  { id: 'keep', label: 'Keep' },
  { id: 'webp', label: 'WebP' },
  { id: 'jpeg', label: 'JPEG' },
];

const TEXTURE_SIZES: { value: number; label: string }[] = [
  { value: 0, label: 'Original' },
  { value: 2048, label: '2048' },
  { value: 1024, label: '1024' },
  { value: 512, label: '512' },
];

function activeCount(o: OptimizeOptions): number {
  let n = 0;
  if (o.draco) n++;
  if (o.cleanup) n++;
  if (o.textureFormat !== 'keep') n++;
  if (o.maxTextureSize > 0) n++;
  return n;
}

export function OptionsPanel({ value, onChange, enabled, disabled }: OptionsPanelProps) {
  const [open, setOpen] = React.useState(false);
  const count = activeCount(value);
  const set = (patch: Partial<OptimizeOptions>) => onChange({ ...value, ...patch });

  return (
    <div className={cn('rounded-xl border border-border', !enabled && 'opacity-60')}>
      <button
        type="button"
        onClick={() => enabled && setOpen((v) => !v)}
        disabled={!enabled}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Optimization
          <span className="text-xs font-normal text-muted-foreground">
            {enabled ? (count ? `· ${count} on` : '· optional') : '· GLB output only'}
          </span>
        </span>
        {enabled && (
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && enabled && (
        <div className="space-y-1 border-t border-border px-4 py-3 animate-fade-in">
          <ToggleRow
            title="Draco compression"
            desc="Shrinks geometry a lot (lossy). Skin weights kept at high precision."
            checked={value.draco}
            disabled={disabled}
            onChange={(v) => set({ draco: v })}
          />
          <ToggleRow
            title="Clean up"
            desc="Remove unused nodes and de-duplicate data (lossless)."
            checked={value.cleanup}
            disabled={disabled}
            onChange={(v) => set({ cleanup: v })}
          />

          <SegmentRow
            title="Texture format"
            options={TEXTURE_FORMATS.map((f) => ({ value: f.id, label: f.label }))}
            value={value.textureFormat}
            disabled={disabled}
            onChange={(v) => set({ textureFormat: v as TextureFormat })}
          />
          <SegmentRow
            title="Max texture size"
            options={TEXTURE_SIZES.map((s) => ({ value: String(s.value), label: s.label }))}
            value={String(value.maxTextureSize)}
            disabled={disabled}
            onChange={(v) => set({ maxTextureSize: Number(v) })}
          />
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

function SegmentRow({
  title,
  options,
  value,
  onChange,
  disabled,
}: {
  title: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex overflow-hidden rounded-lg border border-border">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
              value === o.value ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
