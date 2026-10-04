import { protectedFaces } from './thmanyah-payload.js';

export const THMANYAH_FAMILY = 'Thmanyah Sans';
let ready;

export function decodeProtectedFace(payload, weight) {
  const encoded = atob(payload.data);
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    bytes[i] = encoded.charCodeAt(i) ^ ((i * 73 + Number(weight) + 41) & 255);
  }
  if (bytes.length !== payload.length || String.fromCharCode(...bytes.slice(0, 4)) !== 'wOF2') {
    throw new Error('Protected font payload failed validation');
  }
  return bytes;
}

export function ensureThmanyahFont() {
  if (ready) return ready;
  ready = installThmanyahInDocument(globalThis.document);
  return ready;
}

export async function installThmanyahInDocument(targetDocument) {
  if (!globalThis.FontFace || !targetDocument?.fonts) return false;
  const urls = [];
  try {
    for (const [weight, payload] of Object.entries(protectedFaces)) {
      const bytes = decodeProtectedFace(payload, weight);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'font/woff2' }));
      urls.push(url);
      const face = new FontFace(THMANYAH_FAMILY, `url(${url}) format("woff2")`, { weight, style: 'normal' });
      await face.load();
      targetDocument.fonts.add(face);
    }
    await targetDocument.fonts.ready;
    return ['400', '500', '700', '900'].every((weight) => targetDocument.fonts.check(`${weight} 16px "${THMANYAH_FAMILY}"`));
  } catch (error) {
    console.warn('[font] Thmanyah Sans unavailable; using system fallback', error);
    return false;
  } finally {
    // Loaded FontFace objects hold the decoded face after FontFace.load() and fonts.ready.
    for (const url of urls) URL.revokeObjectURL(url);
  }
}
