import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface Column {
  key: string; // maps a column to the per-row object key (RevoGrid `prop`)
  label?: string; // header text; defaults to `key`
  type?: "text" | "number"; // cell editor/parsing hint
  width?: number;
}
export type Row = Record<string, unknown>;

export interface TableWidget extends Widget<{ columns: Column[]; rows: Row[] }> {
  edited: EventCtor<{ row: number; key: string; value: unknown }>; // a cell (or pasted cell) changed
  contextmenu: EventCtor<{ item: Row; row: number; x: number; y: number }>; // right-click on a row
  editable: boolean;
  maxHeight: number; // height ceiling in px; the grid fits its rows up to this, then scrolls
  data(): Promise<Row[]>; // read all rows
  columnsOf(): Promise<Column[]>; // read the column defs
  setRows(rows: Row[]): void; // replace all rows
  setColumns(columns: Column[]): void; // replace the column defs
  addRow(row: Row): void; // append one row
  setCell(row: number, key: string, value: unknown): void; // set one cell by row index + column key
}

// A tabular widget rendered by RevoGrid (virtualized, range-select, copy/paste, in-cell editing). State
// is the uniform shape — `{ columns, rows }` — and every mutation is a structured edit by path, so a
// cell edit is `set ["rows", r, key]` and a new row is `append ["rows"]`; the grid stays controlled by
// the store on both tiers. Defaults to read-only (a display table); pass `editable: true` to let the
// user edit cells.
export function table(opts: { columns?: Column[]; rows?: Row[]; editable?: boolean; maxHeight?: number } = {}): TableWidget {
  return {
    type: "table",
    state: { columns: opts.columns ?? [], rows: opts.rows ?? [] },
    edited: event<{ row: number; key: string; value: unknown }>("table.edited"),
    contextmenu: event<{ item: Row; row: number; x: number; y: number }>("table.contextmenu"),
    editable: opts.editable ?? false,
    maxHeight: opts.maxHeight ?? 500,
    ...controls,
    data(): Promise<Row[]> {
      return bound(this).read<Row[]>(this, ["rows"]);
    },
    columnsOf(): Promise<Column[]> {
      return bound(this).read<Column[]>(this, ["columns"]);
    },
    setRows(rows: Row[]): void {
      bound(this).edit(this, "set", ["rows"], rows);
    },
    setColumns(columns: Column[]): void {
      bound(this).edit(this, "set", ["columns"], columns);
    },
    addRow(row: Row): void {
      bound(this).edit(this, "append", ["rows"], row);
    },
    setCell(row: number, key: string, value: unknown): void {
      bound(this).edit(this, "set", ["rows", row, key], value);
    },
  };
}
