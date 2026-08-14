import { Component, Suspense, createElement, useCallback, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { isLens } from "../lens.js";
import type { Lens } from "../lens.js";
import { BUSY, ENABLED } from "../types.js";
import type { Id, Path } from "../types.js";
import { viewFor } from "./registry.js";
import type { Store } from "./store.js";

export interface FieldRuntime {
  store: Store;
  emit(id: Id, name: string, payload: unknown): void;
  send(id: Id, name: string, data: unknown): void;
}

class ViewBoundary extends Component<{ type: string; children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error(`knobkit: view "${this.props.type}" crashed`, error);
  }

  override render() {
    if (this.state.error) {
      return <div className="pu-view-error">⚠ {this.props.type}: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

export function Field({ id, runtime }: { id: Id; runtime: FieldRuntime }) {
  const { store } = runtime;
  const subscribe = useCallback((cb: () => void) => store.subscribe(id, cb), [store, id]);
  const inst = useSyncExternalStore(subscribe, () => store.get(id), () => store.get(id));

  const emit = useCallback((name: string, payload?: unknown) => runtime.emit(id, name, payload), [runtime, id]);
  const send = useCallback((chan: string, data: unknown) => runtime.send(id, chan, data), [runtime, id]);
  const set = useCallback(
    (path: Path | Lens<unknown>, value: unknown) => store.setLocal(id, isLens(path) ? path.path : path, value),
    [store, id],
  );
  const slot = useCallback(
    (child: Id): ReactNode => <Field key={child} id={child} runtime={runtime} />,
    [runtime],
  );
  const viewProps = useMemo(
    () => ({ id, props: inst?.props, state: inst?.state, emit, send, set, slot }),
    [id, inst, emit, send, set, slot],
  );

  if (!inst) return null;
  const View = viewFor(inst.type);
  if (!View) return null;
  const enabled = inst.state[ENABLED] !== false;
  const busy = inst.state[BUSY] === true;

  return (
    <div className={`pu-field${enabled ? "" : " pu-disabled"}${busy ? " pu-busy" : ""}`}>
      {busy && <div className="pu-busy-bar" role="status" aria-label="Loading" />}
      <ViewBoundary type={inst.type}>
        <Suspense fallback={null}>{createElement(View, viewProps)}</Suspense>
      </ViewBoundary>
    </div>
  );
}
