import { AssetSummary } from './summary.js';
import { ConversionReport, Direction, ReportCheck } from '../types.js';

/**
 * Compare a count that must be preserved (output should match source).
 * `shortfallStatus` is the severity when the output has fewer than the source —
 * 'fail' for things that must survive (meshes, bones), 'warn' for losses that
 * are an expected format limitation (e.g. PBR textures with no FBX slot).
 */
function countCheck(
  key: string,
  label: string,
  source: number,
  output: number,
  unit = 'preserved',
  shortfallStatus: ReportCheck['status'] = 'fail',
): ReportCheck {
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
  return { key, label, status: shortfallStatus, detail: `${output}/${source} ${unit}`, source, output };
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

  // Materials & textures. A texture shortfall is a warning, not a failure:
  // glTF→FBX commonly drops PBR maps (metallic/roughness/occlusion) that FBX's
  // legacy material model has no slot for, while base color + normal survive.
  checks.push(countCheck('materials', 'Materials', source.materials, output.materials));
  const texShortfallStatus = direction === 'glb2fbx' ? 'warn' : 'fail';
  checks.push(countCheck('textures', 'Textures', source.textures, output.textures, 'preserved', texShortfallStatus));

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
  if (direction === 'glb2fbx' && output.textures < source.textures) {
    const dropped = source.textures - output.textures;
    notes.push(
      `${dropped} texture(s) not written to FBX — glTF packs metallic/roughness/occlusion into maps ` +
        `that FBX's material model has no standard slot for. Base color and normal maps are preserved.`,
    );
  }
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
