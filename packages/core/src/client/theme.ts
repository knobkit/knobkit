import { useSyncExternalStore } from "react";

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function seriesPalette(): string[] {
  return [1, 2, 3, 4, 5, 6].map((i) => cssVar(`--pu-series-${i}`)).filter(Boolean);
}

let version = 0;
const listeners = new Set<() => void>();
let started = false;

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const bump = (): void => {
    version++;
    for (const l of listeners) l();
  };
  new MutationObserver(bump).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-density"],
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", bump);
}

export function onThemeChange(cb: () => void): () => void {
  start();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useThemeVersion(): number {
  return useSyncExternalStore(
    (cb) => onThemeChange(cb),
    () => version,
    () => version,
  );
}
