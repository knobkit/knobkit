import { defineWidget, t, viewRef } from "@knobkit/core";

export const terminal = defineWidget({
  type: "terminal",
  state: { buffer: { initial: "" } },
  props: {
    rows: { default: 24 },
    cols: { default: 80 },
    scrollback: { default: 1000 },
    /** when true the view echoes typed input locally (`\r` → `\r\n`) — no server round-trip */
    echo: { default: false },
  },
  events: {
    data: { payload: t<string>() },
    resized: { payload: t<{ cols: number; rows: number }>() },
  },
  ops: (at) => ({
    write: at("buffer").op("appendText"),
    clear: at("buffer").op("set", ""),
  }),
  methods: (self) => ({
    // \r\n, not \n: xterm needs the carriage return to reach column 0
    writeln: (line: string) => self.at("buffer").appendText(line + "\r\n"),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
