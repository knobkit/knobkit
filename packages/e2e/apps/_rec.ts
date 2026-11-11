import { defineWidget, viewRef } from "knobkit";

// Its own widget rather than `json`: what handlers record can be long (a whole document), and it
// must not take room on the page under test.
const rec = defineWidget({
  type: "e2e/rec",
  state: { value: { initial: [] as { name: string; data: unknown }[] } },
  ops: (at) => ({ add: at("value").op("append") }),
  view: viewRef(import.meta.url, "./_rec-view.js"),
});

/**
 * How a test sees what a handler received, the same way in both modes: handlers push here, the
 * list is ordinary widget state, and the test reads it off the page.
 */
export function recorder() {
  const widget = rec();
  return {
    widget,
    push(name: string, data?: unknown): void {
      widget.add({ name, data: data ?? null });
    },
  };
}
