import { bound } from "./context.js";
import { makeLens } from "./lens.js";
import type { At, Lens } from "./lens.js";
import type { OpName } from "./ops.js";
import type { ChannelPolicy } from "./protocol.js";
import type { PayloadType } from "./schema.js";
import { BUSY, ENABLED } from "./types.js";
import type { Id, Instance, Path } from "./types.js";

// ---------- specs ----------

export interface StateAttrSpec<T = unknown> {
  initial: T;
  validate?: PayloadType<T>;
}
export type StateSpecs = Record<string, StateAttrSpec<any>>;
export type StateOf<SS extends StateSpecs> = { [K in keyof SS]: SS[K]["initial"] } & {
  $enabled: boolean;
  $busy: boolean;
};

export interface PropSpec<T = unknown> {
  default: T;
}
export type PropSpecs = Record<string, PropSpec<any>>;
export type PropsOf<PS extends PropSpecs> = { [K in keyof PS]: PS[K]["default"] };

export interface EventSpec<T = void> {
  payload?: PayloadType<T>;
}
export type EventSpecs = Record<string, EventSpec<any>>;

export interface ChanSpec<T = unknown> {
  policy?: ChannelPolicy;
  data?: PayloadType<T>;
}
export type ChanSpecs = Record<string, ChanSpec<any>>;

type PayloadOf<S> = S extends { payload: PayloadType<infer T> } ? T : void;
type DataOf<S> = S extends { data: PayloadType<infer T> } ? T : unknown;

// ---------- events & channels ----------

export interface EventObj<P = unknown> {
  src: unknown; // Handle — resolved to an Id at the wire
  name: string;
  payload: P;
}

export interface EventCtor<P = void> {
  (payload: P): EventObj<P>;
  src: unknown;
  name: string;
  kind: "event";
}

export interface ChanRef<T = unknown> {
  src: unknown;
  name: string;
  kind: "chan";
  __data?: T;
}

export function isEventObj(v: unknown): v is EventObj {
  return typeof v === "object" && v !== null && isHandle((v as EventObj).src) && typeof (v as EventObj).name === "string";
}

// ---------- ops declarations ----------

export interface OpDecl<Args extends unknown[] = unknown[]> {
  __op: true;
  path: Path;
  op: OpName;
  fixed?: unknown[];
  __args?: Args;
}

type OpArgs<T, N extends OpName> = N extends "set"
  ? [value: T]
  : N extends "append"
    ? [value: T extends readonly (infer E)[] ? E : never]
    : N extends "appendN"
      ? [values: T extends readonly (infer E)[] ? E[] : never]
      : N extends "appendText"
        ? [text: string]
        : N extends "insert"
          ? [index: number, value: T extends readonly (infer E)[] ? E : never]
          : N extends "removeAt"
            ? [index: number, count?: number]
            : N extends "move"
              ? [from: number, to: number]
              : N extends "inc"
                ? [by: number]
                : N extends "patch"
                  ? [partial: T extends object ? Partial<T> : never]
                  : never;

export interface OpsAt<T> {
  op<N extends OpName>(name: N): OpDecl<OpArgs<T, N>>;
  op<N extends OpName>(name: N, ...fixed: OpArgs<T, N>): OpDecl<[]>;
}

export type OpsBuilder<S> = <P extends (string | number)[]>(...path: P) => OpsAt<At<S, P>>;

// ---------- handle ----------

export const HANDLE = Symbol.for("knobkit.handle");

export interface HandleInternal {
  def: WidgetDef;
  props: Record<string, unknown>;
  seedState: Record<string, unknown>;
  id?: Id;
}

export type AnyHandle = { [HANDLE]: HandleInternal };

export function isHandle(v: unknown): v is AnyHandle {
  return typeof v === "object" && v !== null && HANDLE in v;
}

export function internalOf(h: unknown): HandleInternal {
  if (!isHandle(h)) throw new Error("knobkit: not a widget handle");
  return h[HANDLE];
}

export function idOf(h: unknown): Id {
  const id = internalOf(h).id;
  if (!id) throw new Error("knobkit: widget is not part of the app yet — declare it in knobkit({ widgets }) or add() it first");
  return id;
}

type Controls = {
  enable(): void;
  disable(): void;
  setEnabled(value: boolean): void;
  busyStart(): void;
  busyEnd(): void;
  /** Bracket `$busy` around fn; span keyed by (instance, corr) so chained handlers extend it. */
  busy<Pa, R>(fn: (payload: Pa) => R): (payload: Pa) => Promise<Awaited<R>>;
};

export type Handle<
  SS extends StateSpecs = StateSpecs,
  PS extends PropSpecs = PropSpecs,
  ES extends EventSpecs = {},
  CS extends ChanSpecs = {},
  O extends Record<string, OpDecl<any>> = {},
  M extends object = {},
> = { [N in keyof ES]: EventCtor<PayloadOf<ES[N]>> } & { [N in keyof CS]: ChanRef<DataOf<CS[N]>> } & {
  [N in keyof O]: O[N] extends OpDecl<infer A extends unknown[]> ? (...args: A) => void : never;
} & M &
  Controls & {
    at<P extends (string | number)[]>(...path: P): Lens<At<StateOf<SS>, P>>;
  };

export type WidgetOpts<SS extends StateSpecs, PS extends PropSpecs> = Partial<{ [K in keyof SS]: SS[K]["initial"] }> &
  Partial<PropsOf<PS>> & { $enabled?: boolean };

export type WidgetFactory<
  SS extends StateSpecs = StateSpecs,
  PS extends PropSpecs = PropSpecs,
  ES extends EventSpecs = {},
  CS extends ChanSpecs = {},
  O extends Record<string, OpDecl<any>> = {},
  M extends object = {},
> = ((opts?: WidgetOpts<SS, PS>) => Handle<SS, PS, ES, CS, O, M>) & { def: WidgetDef };

// ---------- definition ----------

export interface ViewRef {
  base: string;
  specifier: string;
  /** Filled by a bundler transform (mount tier) — makes the lazy import statically analyzable. */
  load?: () => Promise<unknown>;
}

export function viewRef(base: string, specifier: string, load?: () => Promise<unknown>): ViewRef {
  return { base, specifier, load };
}

export interface WidgetDef {
  type: string;
  state: StateSpecs;
  props: PropSpecs;
  events: EventSpecs;
  channels: ChanSpecs;
  ops?: (at: OpsBuilder<any>) => Record<string, OpDecl<any>>;
  methods?: (self: any) => object;
  view?: ViewRef;
}

const TYPE_RE = /^[a-z][a-zA-Z0-9]*$/;

const RESERVED = new Set(["at", "enable", "disable", "setEnabled", "busyStart", "busyEnd", "busy"]);

export function defineWidget<
  SS extends StateSpecs,
  PS extends PropSpecs = {},
  ES extends EventSpecs = {},
  CS extends ChanSpecs = {},
  O extends Record<string, OpDecl<any>> = {},
  M extends object = {},
>(def: {
  type: string;
  state: SS;
  props?: PS;
  events?: ES;
  channels?: CS;
  ops?: (at: OpsBuilder<StateOf<SS>>) => O;
  methods?: (self: Handle<SS, PS, ES, CS, O>) => M;
  view?: ViewRef;
}): WidgetFactory<SS, PS, ES, CS, O, M> {
  const full: WidgetDef = {
    type: def.type,
    state: def.state,
    props: def.props ?? {},
    events: def.events ?? {},
    channels: def.channels ?? {},
    ops: def.ops as WidgetDef["ops"],
    methods: def.methods as WidgetDef["methods"],
    view: def.view,
  };

  // type format: bare `[a-z][a-zA-Z0-9]*`, or namespaced `<pkgName>/<name>` for third parties
  const lastSegment = full.type.slice(full.type.lastIndexOf("/") + 1);
  if (!TYPE_RE.test(lastSegment) || (full.type.includes("/") && full.type.startsWith("/"))) {
    throw new Error(`knobkit: invalid widget type "${full.type}"`);
  }

  for (const key of Object.keys(full.props)) {
    if (key in full.state) throw new Error(`knobkit: widget "${full.type}": "${key}" is both a prop and a state attr`);
  }
  const memberNames = [...Object.keys(full.events), ...Object.keys(full.channels)];
  for (const key of memberNames) {
    if (RESERVED.has(key)) throw new Error(`knobkit: widget "${full.type}": "${key}" is a reserved handle member`);
  }

  registerWidget(full);

  const factory = ((opts?: Record<string, unknown>) => createHandle(full, opts)) as WidgetFactory<SS, PS, ES, CS, O, M>;
  factory.def = full;
  return factory;
}

function createHandle(def: WidgetDef, opts: Record<string, unknown> = {}): any {
  const props: Record<string, unknown> = {};
  const seedState: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opts)) {
    if (value === undefined) continue;
    if (key in def.state || key === ENABLED || key === BUSY) seedState[key] = value;
    else if (key in def.props) props[key] = value;
    else {
      const known = [...Object.keys(def.state), ...Object.keys(def.props)].join(", ");
      throw new Error(`knobkit: ${def.type}({ ${key} }) — unknown option; expected one of: ${known}`);
    }
  }

  const internal: HandleInternal = { def, props, seedState };
  const h: Record<string | symbol, unknown> = { [HANDLE]: internal };

  for (const name of Object.keys(def.events)) {
    const ctor = ((payload: unknown): EventObj => ({ src: h, name, payload })) as EventCtor<unknown>;
    ctor.src = h;
    Object.defineProperty(ctor, "name", { value: name }); // Function.name is non-writable, but configurable
    ctor.kind = "event";
    h[name] = ctor;
  }
  for (const name of Object.keys(def.channels)) {
    h[name] = { src: h, name, kind: "chan" } satisfies ChanRef;
  }

  const target = () => idOf(h);
  h["at"] = (...path: (string | number)[]) => makeLens(target, path);

  const setEnabled = (value: boolean) => bound().edit([idOf(h), "set", [ENABLED], value]);
  const setBusy = (value: boolean) => bound().edit([idOf(h), "set", [BUSY], value]);
  const span = (delta: number): number => {
    const b = bound();
    const key = idOf(h) + " " + b.corr;
    const next = Math.max(0, (b.spans.get(key) ?? 0) + delta);
    if (next === 0) b.spans.delete(key);
    else b.spans.set(key, next);
    return next;
  };
  h["enable"] = () => setEnabled(true);
  h["disable"] = () => setEnabled(false);
  h["setEnabled"] = setEnabled;
  h["busyStart"] = () => {
    if (span(1) === 1) setBusy(true);
  };
  h["busyEnd"] = () => {
    if (span(-1) === 0) setBusy(false);
  };
  h["busy"] = (fn: (p: unknown) => unknown) => async (payload: unknown) => {
    (h["busyStart"] as () => void)();
    try {
      return await fn(payload);
    } finally {
      (h["busyEnd"] as () => void)();
    }
  };

  if (def.ops) {
    const builder = ((...path: Path) => ({
      op: (name: OpName, ...fixed: unknown[]) =>
        ({ __op: true, path, op: name, fixed: fixed.length > 0 ? fixed : undefined }) as OpDecl,
    })) as unknown as OpsBuilder<any>;
    for (const [key, decl] of Object.entries(def.ops(builder))) {
      if (RESERVED.has(key) || key in h) throw new Error(`knobkit: widget "${def.type}": op "${key}" collides`);
      h[key] = (...args: unknown[]) => {
        bound().edit([idOf(h), decl.op, decl.path, ...(decl.fixed ?? args)]);
      };
    }
  }

  if (def.methods) {
    for (const [key, value] of Object.entries(def.methods(h))) {
      if (RESERVED.has(key) || key in h) throw new Error(`knobkit: widget "${def.type}": method "${key}" collides`);
      h[key] = value;
    }
  }

  return h;
}

// ---------- instantiation (declare walk + spawn share this) ----------

/**
 * Build the Instance for a handle, assigning ids depth-first (parent before children) and lowering
 * any nested handles in seeded state to their ids. `emit` receives every created instance.
 */
export function instantiate(h: unknown, assignId: () => Id, emit: (id: Id, inst: Instance) => void): Id {
  const internal = internalOf(h);
  if (internal.id) throw new Error(`knobkit: widget "${internal.def.type}" is already part of the app`);
  const id = assignId();
  internal.id = id;

  const def = internal.def;
  const props: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(def.props)) props[key] = spec.default;
  Object.assign(props, internal.props);

  const lower = (value: unknown): unknown => {
    if (isHandle(value)) return instantiate(value, assignId, emit);
    if (Array.isArray(value)) return value.map(lower);
    if (typeof value === "object" && value !== null && value.constructor === Object) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, lower(v)]));
    }
    return value;
  };

  const state: Record<string, unknown> = { [ENABLED]: true, [BUSY]: false };
  for (const [key, spec] of Object.entries(def.state)) state[key] = spec.initial;
  for (const [key, value] of Object.entries(internal.seedState)) state[key] = lower(value);

  emit(id, { type: def.type, props, state });
  return id;
}

/**
 * Spawn a handle (and any nested handles in its seeds) at runtime, inside a handler/setup:
 * instances are emitted children-first as `instanceAdd` edits. Returns the root's new id —
 * containers append it to their `items`.
 */
export function spawnTree(h: unknown): Id {
  const b = bound();
  return instantiate(
    h,
    () => b.mintId(),
    (id, inst) => b.edit([id, "instanceAdd", [], inst]),
  );
}

// ---------- registry ----------

const registry = new Map<string, WidgetDef>();

function signature(def: WidgetDef): string {
  return JSON.stringify({
    type: def.type,
    state: Object.keys(def.state).sort(),
    props: Object.keys(def.props).sort(),
    events: Object.keys(def.events).sort(),
    channels: Object.keys(def.channels).sort(),
  });
}

function registerWidget(def: WidgetDef): void {
  const existing = registry.get(def.type);
  if (existing && existing !== def && signature(existing) !== signature(def)) {
    throw new Error(`knobkit: widget type "${def.type}" is already registered with a different definition`);
  }
  registry.set(def.type, def);
}

export function getWidgetDef(type: string): WidgetDef | undefined {
  return registry.get(type);
}

export function allWidgetDefs(): ReadonlyMap<string, WidgetDef> {
  return registry;
}
