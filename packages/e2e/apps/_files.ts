/**
 * A fixture file's bytes, wherever the handler runs: read from disk on the server, fetched from
 * the dev server in the browser (which serves this package's folder).
 */
export async function fixtureBytes(name: string): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof window === "undefined") {
    const fs = await import(/* @vite-ignore */ "node:fs/promises");
    const buf = await fs.readFile(new URL(`../fixtures/${name}`, import.meta.url));
    return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  }
  const res = await fetch(`/fixtures/${name}`);
  if (!res.ok) throw new Error(`fixture ${name}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
