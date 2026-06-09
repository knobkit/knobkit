import "./styles.css";
import { createElement, useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { AppDecl, WidgetDecl } from "../lib/declare.js";
import type { Path } from "../lib/bound.js";
import type { Event } from "../lib/types.js";
import type { Store } from "./runtime.js";
import { VIEWS } from "./widgets/registry.js";

type ByKey = Record<string, WidgetDecl>;

// rebuild a widget's event constructors from the `type` strings in the decl, so a view's
// `emit(widget.changed(v))` produces the right `{ type, payload }`.
function rebuild(decl: WidgetDecl): Record<string, unknown> {
  const widget: Record<string, unknown> = { type: decl.type, ...decl.props };
  for (const [name, type] of Object.entries(decl.events)) {
    widget[name] = (payload: unknown): Event => ({ type, payload });
  }
  return widget;
}

// One widget. It subscribes to its own key, so only the widget whose state (or enabled) changed
// re-renders. The view gets `emit` (events onto the local bus) and `set` (a local state edit for its
// own widget, e.g. an input reflecting typing — no server round-trip).
function Field({ wd, byKey, store, emit }: { wd: WidgetDecl; byKey: ByKey; store: Store; emit: (e: Event) => void }) {
  const subscribe = useCallback((cb: () => void) => store.subscribe(wd.key, cb), [store, wd.key]);
  const cell = useSyncExternalStore(subscribe, () => store.cell(wd.key));
  const widget = useMemo(() => rebuild(wd), [wd]);
  const set = useCallback((path: Path, value: unknown) => store.applyEdit(wd.key, "set", path, value), [store, wd.key]);
  const slot = useCallback(
    (key: string): ReactNode => {
      const child = byKey[key];
      return child ? <Field key={key} wd={child} byKey={byKey} store={store} emit={emit} /> : null;
    },
    [byKey, store, emit],
  );
  const View = VIEWS[wd.type];
  if (!View) return null;
  return (
    <div className={`pu-field${cell.enabled ? "" : " pu-disabled"}${cell.busy ? " pu-busy" : ""}`}>
      {cell.busy && <div className="pu-busy-bar" role="status" aria-label="Loading" />}
      {createElement(View, { widget, state: cell.state, enabled: cell.enabled, emit, set, slot })}
    </div>
  );
}

export function App({ decl, store }: { decl: AppDecl; store: Store }) {
  const emit = (e: Event): void => store.emit(e.type, e.payload);
  const byKey = useMemo<ByKey>(() => Object.fromEntries(decl.widgets.map((wd) => [wd.key, wd])), [decl]);
  const rootWd = byKey[decl.root];
  return (
    <div className="pu-page">
      {decl.title && <h1>{decl.title}</h1>}
      {decl.description && <p className="pu-desc">{decl.description}</p>}
      {rootWd && <Field wd={rootWd} byKey={byKey} store={store} emit={emit} />}
    </div>
  );
}

export function render(decl: AppDecl, store: Store, el: Element): void {
  createRoot(el).render(<App decl={decl} store={store} />);
}
