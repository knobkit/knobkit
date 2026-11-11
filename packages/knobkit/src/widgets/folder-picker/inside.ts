/**
 * Folders on the machine the handlers run on, never above a starting folder. Only called there
 * (Node): the modules are loaded when first needed, so this file can sit in a browser bundle.
 */
const node = async () => {
  const [fs, path] = await Promise.all([import(/* @vite-ignore */ "node:fs/promises"), import(/* @vite-ignore */ "node:path")]);
  return { fs, path };
};

export interface Inside {
  /** the folder's full path, links resolved */
  full: string;
  /** its path inside the starting folder, "/"-separated; "" for the starting folder itself */
  rel: string;
  name: string;
  /** the starting folder's name */
  start: string;
}

/**
 * Resolve `rel` against the starting folder. Throws when the result is not a folder inside it —
 * `..`, an absolute path, or a link that leads out.
 */
export async function inside(root: string, rel: string): Promise<Inside> {
  const { fs, path } = await node();
  const base = await fs.realpath(path.resolve(root || process.cwd()));
  const full = await fs.realpath(path.resolve(base, rel));
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (full !== base && !full.startsWith(prefix)) throw new Error("that folder is outside the starting folder");
  if (!(await fs.stat(full)).isDirectory()) throw new Error("that is not a folder");
  return { full, rel: path.relative(base, full).split(path.sep).join("/"), name: path.basename(full) || full, start: path.basename(base) || base };
}

/** The names of the folders directly inside one, sorted. Links are left out: they may lead anywhere. */
export async function subfolders(full: string): Promise<string[]> {
  const { fs } = await node();
  const entries = await fs.readdir(full, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}
