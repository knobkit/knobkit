import type { AppConfig, KnobkitServer, EventCtor, Widget } from "./types.js";
import type { Handler } from "./on.js";
import { widgetKeys } from "./declare.js";
import { collectSubapps } from "./widgets/embed.js";

// The knobkit is the authored app: a set of widgets plus the `on(event, handler)` handlers registered
// against their events. It holds no state — the browser owns that. Handlers run on the server (serve)
// or in-browser (mount); both resolve a handler by the event's `type`.
export class Knobkit {
  readonly handlers = new Map<string, Handler<any>[]>();
  readonly setups: Array<() => void | Promise<void>> = [];
  private readonly keys: Map<Widget<any>, string>;

  constructor(public config: AppConfig) {
    this.keys = widgetKeys(config.widgets);
    for (const sub of collectSubapps(config.widgets)) {
      for (const [type, hs] of sub.handlers) this.handlers.set(type, [...(this.handlers.get(type) ?? []), ...hs]);
      this.setups.push(...sub.setups);
    }
  }

  keyFor(widget: Widget<any>): string {
    const key = this.keys.get(widget);
    if (!key) throw new Error("widget is not part of this knobkit — pass it to knobkit({ widgets })");
    return key;
  }

  on<P>(source: EventCtor<P>, handler: Handler<P>): this {
    const list = this.handlers.get(source.type) ?? [];
    list.push(handler as Handler<any>);
    this.handlers.set(source.type, list);
    return this;
  }

  setup(fn: () => void | Promise<void>): this {
    this.setups.push(fn);
    return this;
  }

  serverEvents(): string[] {
    return [...this.handlers.keys()];
  }

  mount(selector: string): void {
    void import("../client/mount.js").then(({ mount }) => mount(this, selector));
  }

  serve(opts?: { port?: number; quiet?: boolean }): Promise<KnobkitServer> {
    return import("../server/serve.js").then(({ serve }) => serve(this, opts));
  }
}

export type KnobkitApp = Knobkit;

export function knobkit(config: AppConfig): Knobkit {
  return new Knobkit(config);
}
