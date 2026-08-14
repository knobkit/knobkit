import type { ReactNode } from "react";
import type { Lens } from "../lens.js";
import type { Id, Path } from "../types.js";

export interface ViewProps<S = Record<string, unknown>, P = Record<string, unknown>> {
  id: Id;
  props: P;
  state: S & { $enabled: boolean; $busy: boolean };
  emit: (name: string, payload?: unknown) => void;
  send: (chan: string, data: unknown) => void;
  set: (path: Path | Lens<unknown>, value: unknown) => void;
  slot: (id: Id) => ReactNode;
}

export type WidgetView<S = any, P = any> = (props: ViewProps<S, P>) => ReactNode;
