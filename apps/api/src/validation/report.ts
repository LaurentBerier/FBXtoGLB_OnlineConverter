import { AssetSummary } from './summary.js';
import { ConversionReport, Direction, ReportCheck } from '../types.js';

/** Compare a count that must be preserved (output should match source). */
function countCheck(key: string, label: string, source: number, output: number, unit = 'preserved'): ReportCheck {
  if (source === 0 && output === 0) {
    return { key, label, status: 'ok', detail: `none present`, source, output };
  }
  if (source === 0) {
    // Couldn't determine source count; report what we got but don't fail.
    return { key, label, status: 'warn', detail: `${output} in output (source count unverified)`, source, output };
  }
  if (output >= source) {
    return { key, label, status: 'ok', detail: `${output}/${source} ${unit}`, source, output };
  }
  return { key, label, status: 'fail', detail: `${output}/${source} ${unit}`, source, output };
}

function nameMatchNote(label: string, source: string[], output: string[]): string | null {
  if (source.length === 0 || output.length === 0) return null;
  const outSet = new Set(output.map((n) => n.toLowerCase()));
  const missing = source.filter((n) => n && !outSet.has(n.toLowerCase()));
  if (missing.length === 0) return `${label}: all names matched`;
  const shown = missing.slice(0, 6).join(', ');
  return `${label}: ${missing.length} name(s) differ (${shown}${missing.length > 6 ? '…' : ''})`;
}

export function buildReport(
  direction: Direction,
  inputName: string,
  outputName: string,
  source: AssetSummary,
  output: AssetSummary,
  extraNotes: string[] = [],
): ConversionReport {
  const checks: ReportCheck[] = [];

  // Geometry
  checks.push(countCheck('meshes', 'Meshes', source.meshes, output.meshes));

  // Skeleton
  const bones = countCheck('bones', 'Bones', source.bones, output.bones);
  checks.push(bones);

  // Skinning
  if (source.hasSkin || source.bones > 0) {
    const skinOk = output.hasSkin && output.hasSkinWeights;
    checks.push({
      key: 'skinning',
      label: 'Skinning',
      status: skinOk ? 'ok' : output.hasSkin ? 'warn' : 'fail',
      detail: skinOk ? 'Preserved (clusters + weights)' : output.hasSkin ? 'Clusters present, weights unverified' : 'Lost',
    });
  } else {
    checks.push({ key: 'skinning', label: 'Skinning', status: 'ok', detail: 'No skinning in source' });
  }

  // Animation
  const anim = countCheck('animations', 'Animations', source.animations, output.animations, 'clips preserved');
  checks.push(anim);
  if (source.keyframes > 0 || output.keyframes > 0) {
    const kfStatus = output.keyframes >= source.keyframes || source.keyframes === 0 ? 'ok' : 'warn';
    checks.push({
      key: 'keyframes',
      label: 'Keyframes',
      status: kfStatus,
      detail: source.keyframes
        ? `${output.keyframes}/${source.keyframes} preserved`
        : `${output.keyframes} present`,
      source: source.keyframes,
      output: output.keyframes,
    });
  }

  // Materials & textures
  checks.push(countCheck('materials', 'Materials', source.materials, output.materials));
  checks.push(countCheck('textures', 'Textures', source.textures, output.textures));

  // Orientation (informational)
  if (source.upAxis !== 'unknown' || output.upAxis !== 'unknown') {
    const fmt = (a: string) => (a === 'z' ? 'Z-up' : a === 'y' ? 'Y-up' : 'unknown');
    checks.push({
      key: 'orientation',
      label: 'Orientation',
      status: 'ok',
      detail: `${fmt(source.upAxis)} → ${fmt(output.upAxis)}`,
    });
  }

  // Name-match notes (non-fatal but useful)
  const notes = [...extraNotes, ...source.notes, ...output.notes];
  const boneNote = nameMatchNote('Bone names', source.boneNames, output.boneNames);
  if (boneNote) notes.push(boneNote);
  const animNote = nameMatchNote('Animation names', source.animationNames, output.animationNames);
  if (animNote) notes.push(animNote);

  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');
  const verdict: ConversionReport['verdict'] = hasFail ? 'fail' : hasWarn ? 'pass-with-warnings' : 'pass';

  return {
    direction,
    inputName,
    outputName,
    generatedAt: new Date().toISOString(),
    verdict,
    checks,
    notes,
  };
}
