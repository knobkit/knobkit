/** Instance id: declared `#0…#n` (deterministic tree-walk order), spawned `#s<n>`, root doc `#app`. */
export type Id = string;

export const APP_ID: Id = "#app";

/** A path into an instance's structured state. `-1` addresses the last array element. */
export type Path = (string | number)[];

export interface Instance {
  type: string;
  props: Record<string, unknown>;
  state: Record<string, unknown>;
}

/** The one client-owned document: every widget instance, `#app` included. */
export interface Doc {
  instances: Record<Id, Instance>;
}

/** Opaque handle to bytes kept out of state, in the tier's media store. */
export interface MediaRef {
  $m: string;
  mime: string;
  size: number;
}

export function isMediaRef(v: unknown): v is MediaRef {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as MediaRef).$m === "string" &&
    typeof (v as MediaRef).mime === "string"
  );
}

/** Deep-walk a value for MediaRefs (state enter/leave refcounting, wire-crossing byte transfer). */
export function scanMediaRefs(value: unknown, visit: (ref: MediaRef) => void): void {
  if (typeof value !== "object" || value === null || ArrayBuffer.isView(value)) return;
  if (isMediaRef(value)) return visit(value);
  if (Array.isArray(value)) {
    for (const v of value) scanMediaRefs(v, visit);
    return;
  }
  for (const v of Object.values(value)) scanMediaRefs(v, visit);
}

export const ENABLED = "$enabled";
export const BUSY = "$busy";

export interface KnobkitServer {
  url: string;
  stop(): Promise<void>;
}
