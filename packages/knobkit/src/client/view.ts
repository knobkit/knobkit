import type { ReactNode } from "react";
import type { Path } from "../lib/bound.js";
import type { Emit, Widget } from "../lib/types.js";

// A widget's view: a pure React component that renders the widget's structured state, emits the
// widget's events, and may `set` its own state locally (e.g. an input reflecting what's typed) without
// a server round-trip. It lives in `client` (DOM-only); the isomorphic widget it renders lives in `lib`.
export interface ViewProps<W extends Widget<any> = Widget<any>, S = unknown> {
  widget: W;
  state: S;
  enabled: boolean;
  emit: Emit;
  set: (path: Path, value: unknown) => void;
  slot: (key: string) => ReactNode;
}
export type WidgetView = (props: ViewProps<any, any>) => ReactNode;
