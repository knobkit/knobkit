import { isMediaRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export type DocKind = "pdf" | "docx" | "pptx" | "xlsx" | "markdown" | "text" | "csv" | "image" | "other";

const BY_EXT: Record<string, DocKind> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
  xlsx: "xlsx",
  md: "markdown",
  markdown: "markdown",
  txt: "text",
  text: "text",
  csv: "csv",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  svg: "image",
};

const BY_MIME: Record<string, DocKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/markdown": "markdown",
  "text/x-markdown": "markdown",
  "text/plain": "text",
  "text/csv": "csv",
};

function ofType(type: string): DocKind | undefined {
  const s = type.trim().toLowerCase().split(";")[0]!.trim();
  if (!s) return undefined;
  if (s.includes("/")) return BY_MIME[s] ?? (s.startsWith("image/") ? "image" : undefined);
  return BY_EXT[s.replace(/^\./, "")];
}

function ext(path: string): string {
  const file = path.split(/[?#]/)[0]!.split("/").pop() ?? "";
  const dot = file.lastIndexOf(".");
  return dot < 0 ? "" : file.slice(dot + 1);
}

/** The last part of an address, when it has one that reads as a file name. */
export function nameOf(src: MediaRef | string | null): string {
  if (typeof src !== "string" || /^(data|blob):/i.test(src)) return "";
  const file = src.split(/[?#]/)[0]!.split("/").pop() ?? "";
  try {
    return decodeURIComponent(file);
  } catch {
    return file;
  }
}

/** What to show a file as: the stated type first, then the name, the address, the media type. */
export function kindOf(doc: { src: MediaRef | string | null; type?: string; name?: string }): DocKind {
  const stated = doc.type ? ofType(doc.type) : undefined;
  if (stated) return stated;
  if (doc.type?.trim()) return "other"; // a type was given and it is not one of ours
  const { src } = doc;
  const data = typeof src === "string" ? /^data:([^;,]*)/i.exec(src)?.[1] : undefined;
  return (
    (doc.name ? ofType(ext(doc.name)) : undefined) ??
    (typeof src === "string" && data === undefined ? ofType(ext(src)) : undefined) ??
    (data ? ofType(data) : undefined) ??
    (isMediaRef(src) ? ofType(src.mime) : undefined) ??
    "other"
  );
}
