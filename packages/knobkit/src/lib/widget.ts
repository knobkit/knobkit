import { controls } from "./controls.js";
import type { Emit, SelfListen, Widget } from "./types.js";

export function widget<S>(init: {
  state: S;
  fold?: (state: S, value: any) => S;
  view?: (state: S, emit: Emit) => unknown;
  behavior?: SelfListen<any, any>[];
}): Widget<S> {
  return { state: init.state, fold: init.fold, view: init.view, behavior: init.behavior, ...controls };
}
