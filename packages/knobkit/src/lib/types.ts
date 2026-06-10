import type { Theme, Density } from "./theme.js";

export interface Event<P = unknown> {
  type: string;
  payload: P;
}

export interface EventCtor<P = void> {
  (payload: P): Event<P>;
  type: string;
}

export type Emit = <P>(event: Event<P>) => void;

export type On<P = any> = EventCtor<P> | Widget<any>;

export type Produce<P = any, I = any, V = any> = (
  payload: P,
  inputs: I,
) => V | Promise<V> | AsyncIterable<V>;

export interface Widget<S = unknown> {
  type?: string;
  state: S;
  children?: Widget<any>[];
  fold?: (state: any, value: any) => S;
  behavior?: SelfListen<any, any>[];
  view?: (state: S, emit: Emit) => unknown;
  // Uniform control over whether the widget is interactive — see controls.ts. Provided by every widget
  // factory. enabled is a persistent disable (dimmed); busy is a transient working state (a loading
  // bar). Both drop the input events the widget emits.
  enable(): void;
  disable(): void;
  setEnabled(value: boolean): void;
  busyStart(): void;
  busyEnd(): void;
  busy<P = unknown>(run: (payload: P) => void | Event | Promise<void | Event>): (payload: P) => Promise<void | Event>;
  [key: string]: unknown;
}

export interface SelfListen<P = any, V = any> {
  on: EventCtor<P>;
  from?: Record<string, Widget<any>>;
  respond: Produce<P, any, V>;
}

export interface Listen<P = any, I = any, V = any> {
  on: On<P>;
  in: Widget<any>;
  from?: Record<string, Widget<any>>;
  respond: Produce<P, I, V>;
}

export interface AppConfig {
  title?: string;
  description?: string;
  events?: EventCtor<any>[];
  widgets: Widget<any> | Widget<any>[];
  loading?: string; // raw HTML placed in #root before mount, for serve() (mount apps own index.html)
  theme?: Theme;
  density?: Density;
}

export interface KnobkitServer {
  url: string;
  stop(): Promise<void>;
}
