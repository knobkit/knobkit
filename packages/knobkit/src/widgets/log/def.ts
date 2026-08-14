import { defineWidget, viewRef } from "@knobkit/core";

export type LogLevel = "info" | "warn" | "error" | "debug";

export const log = defineWidget({
  type: "log",
  state: { lines: { initial: [] as string[] }, filter: { initial: "" } },
  props: { maxLines: { default: 0 } }, // 0 = unlimited; the view shows only the last N
  ops: (at) => ({
    push: at("lines").op("append"),
    clear: at("lines").op("set", []),
    setFilter: at("filter").op("set"),
  }),
  methods: (self) => ({
    // lines are plain strings; the level rides as a `[LEVEL]` prefix the view detects for coloring
    pushStyled: (line: string, level: LogLevel = "info"): void =>
      self.at("lines").append(`[${level.toUpperCase()}] ${new Date().toISOString()} ${line}`),
    all: () => self.at("lines").get(),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
