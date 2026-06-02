'use client';

import * as React from 'react';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ACCEPT = '.fbx,.glb,.gltf';
const ACCEPT_EXT = ['fbx', 'glb', 'gltf'];

interface DropzoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  maxSizeMb: number;
  disabled?: boolean;
}

export function Dropzone({ file, onFile, maxSizeMb, disabled }: DropzoneProps) {
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const accept = React.useCallback(
    (f: File) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (!ACCEPT_EXT.includes(ext)) {
        setError(`Unsupported file. Use ${ACCEPT_EXT.map((e) => `.${e}`).join(', ')}.`);
        return;
      }
      if (f.size > maxSizeMb * 1024 * 1024) {
        setError(`File is too large. Max ${maxSizeMb} MB.`);
        return;
      }
      setError(null);
      onFile(f);
    },
    [maxSizeMb, onFile],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) accept(f);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-6 py-14 text-center transition-colors',
          dragging && 'border-primary bg-accent/60',
          disabled && 'pointer-events-none opacity-60',
          !file && 'hover:border-primary/60 hover:bg-accent/30',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) accept(f);
            e.target.value = '';
          }}
        />

        {!file ? (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <UploadCloud className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-base font-medium">
              Drag &amp; drop your model here, or <span className="text-primary underline">browse</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              FBX, GLB or glTF · up to {maxSizeMb} MB
            </p>
          </>
        ) : (
          <div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-border bg-background p-3 text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
              <FileIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onFile(null);
                setError(null);
              }}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
