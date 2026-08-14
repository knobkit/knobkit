import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { getWidgetDef } from "../widget.js";
import type { ViewRef } from "../widget.js";

type ViewModule = { default: ComponentType<any> };

const loaders = new Map<string, () => Promise<ViewModule>>();
const cache = new Map<string, LazyExoticComponent<ComponentType<any>>>();

export function register(type: string, loader: () => Promise<ViewModule>): void {
  loaders.set(type, loader);
  cache.delete(type);
}

function loaderFor(type: string): (() => Promise<ViewModule>) | undefined {
  const registered = loaders.get(type);
  if (registered) return registered;
  const ref = getWidgetDef(type)?.view;
  if (!ref) return undefined;
  return () => resolveViewRef(ref) as Promise<ViewModule>;
}

export function resolveViewRef(ref: ViewRef): Promise<unknown> {
  if (ref.load) return ref.load();
  return import(/* @vite-ignore */ new URL(ref.specifier, ref.base).href);
}

export function viewFor(type: string): ComponentType<any> | undefined {
  const cached = cache.get(type);
  if (cached) return cached;
  const loader = loaderFor(type);
  if (!loader) return undefined;
  const view = lazy(() =>
    loader().then((m) => {
      if (!m.default) throw new Error(`knobkit: view module for "${type}" has no default export`);
      return { default: m.default };
    }),
  );
  cache.set(type, view);
  return view;
}
