import type { Plugin } from "vite";

// Rewrites viewRef(import.meta.url, "./view.js") to include a load thunk so bundlers can
// statically resolve view modules; applies equally to third-party widget packages.

const CALL = /viewRef\(\s*import\.meta\.url\s*,\s*(["'][^"']+["'])\s*\)/g;

export function viewRefTransform(): Plugin {
  return {
    name: "knobkit:view-refs",
    enforce: "pre",
    transform(code: string) {
      if (!code.includes("viewRef(")) return null;
      const out = code.replace(CALL, (_m, spec: string) => `viewRef(import.meta.url, ${spec}, () => import(${spec}))`);
      return out === code ? null : { code: out, map: null };
    },
  };
}
