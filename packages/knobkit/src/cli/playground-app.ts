import { knobkit, code, frame, dropdown, row, col, bound, type Bound } from "../lib/index.js";
import { readFileSync, writeFileSync, watch, readdirSync, type FSWatcher } from "node:fs";
import { relative, resolve, dirname, extname, join } from "node:path";

const ENTRY = process.env.KNOBKIT_PG_FILE ?? "";
const PREVIEW = process.env.KNOBKIT_PG_PREVIEW ?? "";
const PORT = Number(process.env.KNOBKIT_PG_PORT ?? 4317);
const TIER = process.env.KNOBKIT_PG_TIER === "serve" ? "serve" : "mount";
const ROOT = ENTRY ? dirname(ENTRY) : process.cwd();

const LANGS: Record<string, string> = {
  ".tsx": "tsx",
  ".ts": "typescript",
  ".jsx": "jsx",
  ".js": "javascript",
  ".css": "css",
  ".json": "json",
  ".md": "markdown",
  ".html": "html",
};
const langOf = (file: string): string => LANGS[extname(file)] ?? "";

function walk(dir: string, base = ""): string[] {
  let out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      out = out.concat(walk(join(dir, e.name), rel));
    } else if (extname(e.name) in LANGS) {
      out.push(rel);
    }
  }
  return out;
}

function projectFiles(): string[] {
  const entryRel = ENTRY ? relative(ROOT, ENTRY).split("\\").join("/") : "";
  const rest = walk(ROOT)
    .map((n) => n.split("\\").join("/"))
    .filter((n) => n !== entryRel)
    .sort();
  return entryRel ? [entryRel, ...rest] : rest;
}

const files = projectFiles();
let activeRel = files[0] ?? (ENTRY ? relative(ROOT, ENTRY) : "");
const abs = (rel: string): string => resolve(ROOT, rel);
const read = (rel: string): string => {
  try {
    return readFileSync(abs(rel), "utf8");
  } catch {
    return "";
  }
};

const picker = dropdown({ choices: files });
const editor = code({ language: langOf(activeRel), value: read(activeRel), wrap: true });
const preview = frame({ src: PREVIEW, title: "preview" });

const left = files.length > 1 ? col(picker, editor) : editor;
const app = knobkit({
  title: "knobkit playground",
  description:
    files.length > 1 ? "edits save and the preview updates live" : `${activeRel} — edits save and the preview updates live`,
  widgets: row(left, preview),
  fill: true,
});

let conn: Bound | undefined;
let watcher: FSWatcher | undefined;
let writeTimer: ReturnType<typeof setTimeout> | undefined;
let reloadTimer: ReturnType<typeof setTimeout> | undefined;
let lastWritten = read(activeRel);

function rearm(): void {
  watcher?.close();
  watcher = undefined;
  lastWritten = read(activeRel);
  if (!activeRel) return;
  watcher = watch(abs(activeRel), () => {
    const next = read(activeRel);
    if (next === lastWritten || !conn) return;
    lastWritten = next;
    conn.edit(editor, "set", ["value"], next);
  });
}

app.setup(async () => {
  conn = bound(editor);
  rearm();
});

app.on(picker.changed, async (name: string) => {
  if (!files.includes(name) || !conn) return;
  activeRel = name;
  rearm();
  conn.edit(editor, "set", ["language"], langOf(activeRel));
  conn.edit(editor, "set", ["value"], read(activeRel));
});

app.on(editor.changed, async (value: string) => {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    lastWritten = value;
    try {
      writeFileSync(abs(activeRel), value);
    } catch (err) {
      console.error("playground: failed to write", activeRel, err);
      return;
    }
    if (TIER === "serve" && conn) {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        conn!.edit(preview, "set", ["src"], "");
        conn!.edit(preview, "set", ["src"], PREVIEW);
      }, 900);
    }
  }, 400);
});

void app.serve({ port: PORT, quiet: true });
