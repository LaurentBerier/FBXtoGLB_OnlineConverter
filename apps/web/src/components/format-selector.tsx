'use client';

import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Direction } from '@/lib/api';

interface FormatSelectorProps {
  value: Direction;
  onChange: (d: Direction) => void;
  available: { fbx2glb: boolean; glb2fbx: boolean };
  disabled?: boolean;
}

const OPTIONS: { id: Direction; from: string; to: string }[] = [
  { id: 'fbx2glb', from: 'FBX', to: 'GLB' },
  { id: 'glb2fbx', from: 'GLB', to: 'FBX' },
];

export function FormatSelector({ value, onChange, available, disabled }: FormatSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map((opt) => {
        const enabled = available[opt.id];
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled || !enabled}
            onClick={() => onChange(opt.id)}
            className={cn(
              'group flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all',
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50',
              (disabled || !enabled) && 'cursor-not-allowed opacity-50',
            )}
            title={enabled ? undefined : 'Engine not installed on the server'}
          >
            <span>{opt.from}</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
            <span>{opt.to}</span>
          </button>
        );
      })}
    </div>
  );
}
