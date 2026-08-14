import { defineWidget, t, viewRef } from "@knobkit/core";

export interface Column {
  key: string; // maps a column to the per-row object key (RevoGrid `prop`)
  label?: string; // header text; defaults to `key`
  type?: "text" | "number"; // cell editor/parsing hint
  width?: number;
}
export type Row = Record<string, unknown>;

export const table = defineWidget({
  type: "table",
  state: {
    columns: { initial: [] as Column[] },
    rows: { initial: [] as Row[] },
  },
  props: {
    editable: { default: false },
    maxHeight: { default: 500 }, // height ceiling in px; the grid fits its rows up to this, then scrolls
  },
  events: {
    edited: { payload: t<{ row: number; key: string; value: unknown }>() },
    contextmenu: { payload: t<{ item: Row; row: number; x: number; y: number }>() },
  },
  ops: (at) => ({
    setRows: at("rows").op("set"),
    setColumns: at("columns").op("set"),
    addRow: at("rows").op("append"),
  }),
  methods: (self) => ({
    data: () => self.at("rows").get(),
    columnsOf: () => self.at("columns").get(),
    setCell: (row: number, key: string, value: unknown) => self.at("rows", row, key).set(value),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
