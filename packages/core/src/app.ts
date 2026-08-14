import { bound } from "./context.js";
import { isLens } from "./lens.js";
import type { Lens } from "./lens.js";
import type { ChannelPolicy, SubDecl } from "./protocol.js";
import { idOf, instantiate, internalOf, isHandle } from "./widget.js";
import type { ChanRef, EventCtor, EventObj } from "./widget.js";
import { APP_ID, BUSY, ENABLED } from "./types.js";
import type { Doc, Id, KnobkitServer, Path } from "./types.js";

export type HandlerCtx = { corr: string; session: string };
export type Handler<P> = (payload: P, ctx?: HandlerCtx) => unknown;

export type DispatchPolicy = "serial" | "concurrent" | "latest" | "queue";

export interface OnOpts {
  snap?: Lens<unknown>[];
  gate?: boolean;
  policy?: DispatchPolicy;
  debounceMs?: number;
}

export interface SubEntry {
  src: unknown; // handle
  name: string;
  chan: boolean;
  handler: Handler<unknown>;
  opts: OnOpts;
}

export interface WatchEntry {
  wid: number;
  lens: Lens<unknown>;
  handler: Handler<unknown>;
  throttleMs?: number;
}

export interface AppConfig {
  title?: string;
  description?: string;
  theme?: string;
  density?: string;
  fill?: boolean;
  widgets: unknown;
}

export type Middleware = (msg: unknown, next: () => void) => void;

export class App {
  readonly subs: SubEntry[] = [];
  readonly watches: WatchEntry[] = [];
  readonly setups: Array<() => unknown> = [];
  readonly middlewares: Middleware[] = [];
  private doc: Doc | null = null;

  constructor(readonly config: AppConfig) {}

  on<P>(source: EventCtor<P> | ChanRef<P>, handler: Handler<P>, opts?: OnOpts): this {
    const src = (source as EventCtor<P>).src;
    if (!isHandle(src)) throw new Error("knobkit: on() source must be a widget event or channel");
    this.subs.push({
      src,
      name: source.name,
      chan: (source as ChanRef).kind === "chan",
      handler: handler as Handler<unknown>,
      opts: opts ?? {},
    });
    return this;
  }

  watch<T>(lens: Lens<T>, handler: (value: T, ctx?: HandlerCtx) => unknown, opts?: { throttleMs?: number }): this {
    if (!isLens(lens)) throw new Error("knobkit: watch() takes a widget lens, e.g. w.at(\"value\")");
    this.watches.push({
      wid: this.watches.length,
      lens: lens as Lens<unknown>,
      handler: handler as Handler<unknown>,
      throttleMs: opts?.throttleMs,
    });
    return this;
  }

  setup(fn: () => unknown): this {
    this.setups.push(fn);
    return this;
  }

  use(mw: Middleware): this {
    this.middlewares.push(mw);
    return this;
  }

  /** Remove a spawned (or declared) widget: `instanceRemove` + release of its MediaRefs. */
  dispose(w: unknown): void {
    bound().dispose(idOf(w));
  }

  declare(): Doc {
    if (this.doc) return this.doc;
    const instances: Record<Id, Doc["instances"][Id]> = {};
    let n = 0;
    const assignId = () => `#${n++}`;
    const emit = (id: Id, inst: Doc["instances"][Id]) => {
      instances[id] = inst;
    };

    const w = this.config.widgets;
    let root: Id;
    if (Array.isArray(w)) {
      // implicit column for an authored array — an ordinary "col" instance (view from the standard library)
      root = assignId();
      const items = w.map((child) => instantiate(child, assignId, emit));
      instances[root] = { type: "col", props: {}, state: { [ENABLED]: true, [BUSY]: false, items } };
    } else {
      root = instantiate(w, assignId, emit);
    }

    instances[APP_ID] = {
      type: "app",
      props: {},
      state: {
        [ENABLED]: true,
        [BUSY]: false,
        root,
        title: this.config.title,
        description: this.config.description,
        theme: this.config.theme,
        density: this.config.density,
        fill: this.config.fill ?? false,
      },
    };
    this.doc = { instances };
    return this.doc;
  }

  subDecls(): SubDecl[] {
    this.declare();
    return this.subs.map((sub) => {
      const def = internalOf(sub.src).def;
      const decl: SubDecl = { src: idOf(sub.src), name: sub.name };
      if (sub.chan) {
        decl.chan = true;
        decl.policy = def.channels[sub.name]?.policy ?? "buffer";
      }
      if (sub.opts.gate === false) decl.gate = false;
      if (sub.opts.snap) decl.snap = sub.opts.snap.map((l) => [l.__target(), l.path] as [Id, Path]);
      return decl;
    });
  }

  chanPolicy(srcId: Id, name: string): ChannelPolicy {
    for (const sub of this.subs) {
      if (sub.chan && sub.name === name && internalOf(sub.src).id === srcId) {
        return internalOf(sub.src).def.channels[name]?.policy ?? "buffer";
      }
    }
    return "buffer";
  }

  mount(selector: string): void {
    void import("@knobkit/core/client").then(({ mountApp }) => mountApp(this, selector));
  }

  serve(opts?: { port?: number; quiet?: boolean }): Promise<KnobkitServer> {
    return import("@knobkit/core/server").then(({ serveApp }) => serveApp(this, opts));
  }
}

export function knobkit(config: AppConfig): App {
  return new App(config);
}
