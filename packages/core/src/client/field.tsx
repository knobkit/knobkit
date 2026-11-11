import { puBounded, puBusy, puBusyBar, puDisabled, puField, puFillX, puFillY, puOffered, puPassY, puSlot } from "./styles.css.js";
import { puViewError } from "./overlay.css.js";
import { Component, Suspense, createElement, useCallback, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import { isLens } from "../lens.js";
import type { Lens } from "../lens.js";
import { BUSY, COLSPAN, DEFAULT_SIZE, DENSITY, ENABLED, GROW, ROWSPAN, SIZE, SLOTS, THEME } from "../types.js";
import type { Id, Path, SizeSpec } from "../types.js";
import { viewFor } from "./registry.js";
import type { Store } from "./store.js";

export interface FieldRuntime {
  store: Store;
  emit(id: Id, name: string, payload: unknown): string | undefined;
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
      return <div className={puViewError}>⚠ {this.props.type}: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

/**
 * `distributed` is set by a parent whose def declares `slots: "distribute"` — see slot() below.
 * `offered` says the height on offer is a definite one: the parent's own box is bounded, all the
 * way up to a page that fills the window. `root` marks the page's one field, which is given the
 * window's height whatever it declares.
 */
export function Field({
  id,
  runtime,
  distributed = false,
  offered = false,
  root = false,
}: {
  id: Id;
  runtime: FieldRuntime;
  distributed?: boolean;
  offered?: boolean;
  root?: boolean;
}) {
  const { store } = runtime;
  const subscribe = useCallback((cb: () => void) => store.subscribe(id, cb), [store, id]);
  const inst = useSyncExternalStore(subscribe, () => store.get(id), () => store.get(id));

  const emit = useCallback((name: string, payload?: unknown) => runtime.emit(id, name, payload), [runtime, id]);
  const send = useCallback((chan: string, data: unknown) => runtime.send(id, chan, data), [runtime, id]);
  const set = useCallback(
    (path: Path | Lens<unknown>, value: unknown) => store.setLocal(id, isLens(path) ? path.path : path, value),
    [store, id],
  );
  const distributes = inst?.props[SLOTS] === true;
  const sizeY = (inst?.props[SIZE] as SizeSpec | undefined)?.y ?? DEFAULT_SIZE.y;
  // what this field can hand its own slots: a definite height, if it was offered one and takes it.
  // A `pass` container takes it only when something inside fills — which is the only case in which
  // a child would use the offer, so the offer can be made unconditionally.
  const gives = distributes && offered && (root || sizeY !== "intrinsic" || inst?.props[GROW] === true);
  const slot = useCallback(
    (child: Id): ReactNode => <Field key={child} id={child} runtime={runtime} distributed={distributes} offered={gives} />,
    [runtime, distributes, gives],
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

  const colspan = typeof inst.props[COLSPAN] === "number" ? (inst.props[COLSPAN] as number) : 1;
  const rowspan = typeof inst.props[ROWSPAN] === "number" ? (inst.props[ROWSPAN] as number) : 1;
  const spanStyle: CSSProperties | undefined =
    colspan > 1 || rowspan > 1
      ? { gridColumn: colspan > 1 ? `span ${colspan}` : undefined, gridRow: rowspan > 1 ? `span ${rowspan}` : undefined }
      : undefined;
  const grows = inst.props[GROW] === true;
  const grow = grows ? " pu-field-grow" : "";
  // a widget only *claims* space inside a container that distributes it; elsewhere `fill` degrades
  // to its intrinsic size rather than collapsing against an indefinite parent
  const size: Required<SizeSpec> = { ...DEFAULT_SIZE, ...((inst.props[SIZE] as SizeSpec | undefined) ?? {}) };
  const fill =
    (size.x === "fill" ? ` ${puFillX}` : "") +
    (size.y === "fill" ? ` ${puFillY}` : "") +
    (size.y === "pass" ? ` ${puPassY}` : "") +
    (distributed ? ` ${puSlot}` : "") +
    (distributed && offered ? ` ${puOffered}` : "") +
    // its box has a definite height: a widget's own stylesheet keys its bounded form off this
    (distributed && offered && (root || size.y === "fill" || grows) ? ` ${puBounded}` : "");
  const density = typeof inst.props[DENSITY] === "string" ? (inst.props[DENSITY] as string) : undefined;
  const theme = typeof inst.props[THEME] === "string" ? (inst.props[THEME] as string) : undefined;

  return (
    <div
      className={`${puField}${enabled ? "" : ` ${puDisabled}`}${busy ? ` ${puBusy}` : ""}${grow}${fill}`}
      style={spanStyle}
      data-density={density}
      data-theme={theme}
    >
      {busy && <div className={puBusyBar} role="status" aria-label="Loading" />}
      <ViewBoundary type={inst.type}>
        <Suspense fallback={null}>{createElement(View, viewProps)}</Suspense>
      </ViewBoundary>
    </div>
  );
}
