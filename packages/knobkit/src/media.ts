export { toMedia, mediaBytes, mediaUrl } from "@knobkit/core";
export type { MediaRef } from "@knobkit/core";

export function dataUrlToBytes(url: string): { bytes: Uint8Array; mime: string } {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
  if (!m) throw new Error("knobkit: not a data URL");
  const mime = m[1] ?? "application/octet-stream";
  if (!m[2]) return { bytes: new TextEncoder().encode(decodeURIComponent(m[3]!)), mime };
  const bin = atob(m[3]!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

/** 16-bit PCM WAV from mono float samples — e.g. TTS output for `audio.set`. */
export function pcmToWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const data = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(data.buffer);
  const ascii = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) data[offset + i] = s.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return data;
}
