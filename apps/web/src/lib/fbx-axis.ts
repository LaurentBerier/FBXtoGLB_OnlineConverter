export type UpAxis = 'y' | 'z' | 'unknown';

/**
 * Detect the up-axis of an FBX from its GlobalSettings.UpAxis property
 * (0=X, 1=Y, 2=Z). glTF/GLB is always Y-up, so this only applies to FBX.
 * Reads just the head of the file — GlobalSettings sits near the start.
 */
export async function detectFbxUpAxis(file: File | Blob): Promise<UpAxis> {
  const head = await file.slice(0, 1_000_000).arrayBuffer();
  return detectUpAxisFromBuffer(head);
}

export function detectUpAxisFromBuffer(buf: ArrayBuffer): UpAxis {
  const bytes = new Uint8Array(buf);
  const header = latin1(bytes.subarray(0, 21));

  if (header.startsWith('Kaydara FBX Binary')) {
    // Binary: match the exact property string record  'S' + uint32(6) + "UpAxis"
    // (length 6 disambiguates from "UpAxisSign", which is length 10).
    const pattern = [0x53, 0x06, 0x00, 0x00, 0x00, 0x55, 0x70, 0x41, 0x78, 0x69, 0x73]; // S,6,"UpAxis"
    const at = indexOfBytes(bytes, pattern);
    if (at < 0) return 'unknown';
    const value = readScalarAfter(new DataView(buf), at + pattern.length);
    return value === 2 ? 'z' : value === 1 ? 'y' : 'unknown';
  }

  // ASCII FBX: P: "UpAxis", "int", "Integer", "",2
  const text = latin1(bytes);
  const m = text.match(/UpAxis"\s*,\s*"int"\s*,\s*"Integer"\s*,\s*""\s*,\s*(-?\d+)/);
  if (m) {
    const v = Number.parseInt(m[1], 10);
    return v === 2 ? 'z' : v === 1 ? 'y' : 'unknown';
  }
  return 'unknown';
}

function latin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

function indexOfBytes(haystack: Uint8Array, needle: number[]): number {
  const limit = haystack.length - needle.length;
  for (let i = 0; i <= limit; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

/** Read the first numeric FBX property after `pos`, skipping string props. */
function readScalarAfter(view: DataView, pos: number): number | null {
  let p = pos;
  for (let guard = 0; guard < 8 && p < view.byteLength; guard++) {
    const type = String.fromCharCode(view.getUint8(p));
    p += 1;
    switch (type) {
      case 'S':
      case 'R': {
        const len = view.getUint32(p, true);
        p += 4 + len;
        break;
      }
      case 'I':
        return view.getInt32(p, true);
      case 'L':
        return Number(view.getBigInt64(p, true));
      case 'Y':
        return view.getInt16(p, true);
      case 'C':
      case 'B':
        return view.getUint8(p);
      case 'D':
        return Math.round(view.getFloat64(p, true));
      case 'F':
        return Math.round(view.getFloat32(p, true));
      default:
        return null;
    }
  }
  return null;
}
