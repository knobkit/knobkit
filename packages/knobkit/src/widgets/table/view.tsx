import { puTable } from "./table.css.js";
import { titleWhenCut } from "../_primitives/cut-title.js";
import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { RevoGrid } from "@revolist/react-datagrid";
import type { ViewProps } from "@knobkit/core/client";
import type { Column, Row } from "./def.js";

// @revolist/revogrid's d.ts uses extensionless relative re-exports NodeNext can't resolve, so these structural stand-ins replace its named types
interface GridColumn {
  prop: string;
  name: string;
  sortable: boolean;
  readonly: boolean;
  size: number;
  rowDrag?: boolean;
}
type GridRow = Record<string, unknown>;

// "compact" theme metrics (from revo-grid-style.css): header row 45px, data row 32px — used to fit
// the grid to its content up to maxHeight, then scroll.
const HEADER_PX = 45;
const ROW_PX = 32;

// A column with no explicit width is at least as wide as its *header* — often the wider constraint
// for compact tables (e.g. "Δ from mean" over numeric cells). Measured with canvas for
// proportional-font accuracy.
const HEADER_FONT = "600 14px Helvetica, Arial, sans-serif"; // compact theme header
const COL_PAD = 34; // header cell padding + room for the sort arrow
const DRAG_PX = 24; // the row-drag handle, in the first column of a reorderable grid
const MIN_COL = 80;
const MAX_COL = 240;
let measureCtx: CanvasRenderingContext2D | null | undefined;
function headerWidth(label: string): number {
  if (measureCtx === undefined) measureCtx = document.createElement("canvas").getContext("2d");
  let w: number;
  if (measureCtx) {
    measureCtx.font = HEADER_FONT;
    w = measureCtx.measureText(label).width;
  } else {
    w = label.length * 8; // canvas unavailable: rough fallback
  }
  return Math.max(MIN_COL, Math.min(MAX_COL, Math.ceil(w) + COL_PAD));
}

// A column also fits its cells' text (the body font and padding of the compact theme), so a value is
// not cut while the grid has room for it. Long text stops at MAX_FIT and is read by hovering.
const CELL_FONT = '14px Nunito, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const CELL_PAD = 32; // 15px each side, and the cell's border
const MAX_FIT = 480;
const MIN_SHRUNK = 40; // the narrowest a column is squeezed to before the grid scrolls sideways instead
const ROW_HEADER_PX = 50; // the row-number column
const FIT_ROWS = 500; // rows measured; past these the header and the first rows decide
function textWidth(text: string): number {
  if (measureCtx === undefined) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * 8;
  measureCtx.font = CELL_FONT;
  return measureCtx.measureText(text).width;
}

/**
 * Column widths for the room there is: each as wide as its header and its text need; when that is
 * more than the grid has, the columns without a set width are narrowed in proportion.
 */
function fitColumns(columns: Column[], rows: Row[], room: number, extraFirst: number): number[] {
  const sample = rows.length > FIT_ROWS ? rows.slice(0, FIT_ROWS) : rows;
  const want = columns.map((c, i) => {
    if (c.width !== undefined) return c.width;
    let w = 0;
    for (const r of sample) {
      const v = r[c.key];
      if (v !== null && v !== undefined && v !== "") w = Math.max(w, textWidth(String(v)));
    }
    const fit = Math.min(MAX_FIT, Math.ceil(w) + CELL_PAD + (i === 0 ? extraFirst : 0));
    return Math.max(headerWidth(c.label ?? c.key) + (i === 0 ? extraFirst : 0), fit);
  });
  const total = want.reduce((a, b) => a + b, 0);
  if (room <= 0 || total <= room) return want;
  // narrow the columns without a set width in proportion; one that reaches the floor stays there and
  // the others take up what it could not give
  const out = want.slice();
  const open = new Set(columns.map((c, i) => (c.width === undefined ? i : -1)).filter((i) => i >= 0));
  let left = room - columns.reduce((a, c, i) => a + (c.width !== undefined ? want[i]! : 0), 0);
  while (open.size > 0) {
    const wanted = [...open].reduce((a, i) => a + want[i]!, 0);
    const scale = Math.max(0, left) / wanted;
    const floored = [...open].filter((i) => want[i]! * scale < MIN_SHRUNK);
    if (floored.length === 0) {
      for (const i of open) out[i] = Math.floor(want[i]! * scale);
      break;
    }
    for (const i of floored) {
      out[i] = Math.min(want[i]!, MIN_SHRUNK);
      left -= out[i]!;
      open.delete(i);
    }
  }
  return out;
}

interface Props {
  editable: boolean;
  reorderable: boolean;
  maxHeight: number;
}

export default function TableView({ props, state, emit, set }: ViewProps<{ columns: Column[]; rows: Row[]; selected: number | null }, Props>) {
  const { editable, reorderable, maxHeight } = props;
  // fit to content (header + rows), capped at maxHeight; +2 leaves room for a horizontal scrollbar so
  // a fitting grid doesn't sprout a vertical one
  const height = Math.min(maxHeight, HEADER_PX + state.rows.length * ROW_PX + 2);

  // the width the grid has, to share between the columns
  const boxRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = (): void => setRoom(Math.max(0, Math.floor(el.clientWidth) - ROW_HEADER_PX));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Widths follow the text and the room, but the array handed to the grid changes only when a width
  // does: a new one resets a column the user has resized by hand.
  const sizesRef = useRef<number[]>([]);
  const sizes = useMemo(() => {
    const next = fitColumns(state.columns, state.rows, room, reorderable ? DRAG_PX : 0);
    const prev = sizesRef.current;
    if (prev.length === next.length && prev.every((w, i) => w === next[i])) return prev;
    sizesRef.current = next;
    return next;
  }, [state.columns, state.rows, room, reorderable]);

  // RevoGrid warns that columns/source need stable references; the store hands us a fresh state object
  // only on a real edit (edits are immutable), so memoizing on those references is both stable and correct.
  const columns = useMemo<GridColumn[]>(
    () =>
      state.columns.map((c, i) => ({
        prop: c.key,
        name: c.label ?? c.key,
        // rows the user orders by hand are not also sorted by a column: a place in a sorted list means nothing
        sortable: !reorderable,
        readonly: !editable,
        size: sizes[i] ?? MIN_COL,
        ...(reorderable && i === 0 ? { rowDrag: true } : {}), // the handle sits in the first column
      })),
    [state.columns, editable, reorderable, sizes],
  );
  // clone each row: RevoGrid mutates its own source in place on edit — we must not let it touch the
  // store's state objects. The real change is applied through the store via onAfteredit below.
  // (`rejected` hands the grid a fresh copy after an edit that was not taken, undoing the grid's own.)
  const [rejected, setRejected] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const source = useMemo<GridRow[]>(() => state.rows.map((r) => ({ ...r })), [state.rows, rejected]);

  const selectedRef = useRef<number | null>(state.selected);
  selectedRef.current = state.selected;

  const apply = (row: number, key: string, typedValue: unknown): void => {
    // the grid's editor hands over text; a number column holds numbers
    let value = typedValue;
    if (typeof value !== "number" && state.columns.find((c) => c.key === key)?.type === "number") {
      const text = String(value ?? "").trim();
      const n = text === "" ? null : Number(text);
      if (n !== null && !Number.isFinite(n)) {
        setRejected((r) => r + 1); // not a number: the cell goes back to what it held
        return;
      }
      value = n;
      if (state.rows[row]?.[key] === value) setRejected((r) => r + 1); // "4" over 4: nothing to send, but redraw the 4
    }
    // a range/paste commit reports every cell in the selection; skip the ones that didn't change so
    // handlers don't see no-op edits
    if (state.rows[row]?.[key] === value) return;
    set(["rows", row, key], value); // local edit by path; reads reflect it immediately
    emit("edited", { row, key, value });
  };

  const onAfteredit = (e: CustomEvent): void => {
    const d = e.detail as Record<string, unknown>;
    if (d && "data" in d) {
      // range / paste edit: { data: { [rowIndex]: changedRowModel } }
      for (const [ri, model] of Object.entries(d.data as Record<string, Record<string, unknown>>)) {
        for (const [key, value] of Object.entries(model)) apply(Number(ri), key, value);
      }
    } else if (d) {
      // single cell: val is the editor's new value, not yet in the model
      apply(d.rowIndex as number, d.prop as string, d.val);
    }
  };

  // the row model as the grid shows it — visible order diverges from state.rows under sort
  const shown = async (grid: Element | null, row: number): Promise<Row | undefined> => {
    const g = grid as (Element & { getVisibleSource?: () => Promise<Row[]> }) | null;
    return (g?.getVisibleSource ? (await g.getVisibleSource())[row] : undefined) ?? state.rows[row];
  };

  // the user is on another row: by a click anywhere in it (its number included), or with the keyboard
  const select = async (grid: Element | null, row: number): Promise<void> => {
    if (!Number.isInteger(row) || row < 0 || row === selectedRef.current) return;
    selectedRef.current = row;
    const item = await shown(grid, row);
    if (!item) return;
    set(["selected"], row);
    emit("selected", { row, item });
  };
  const onClick = (e: MouseEvent): void => {
    const cell = (e.target as HTMLElement).closest("[data-rgrow]");
    if (cell) void select(cell.closest("revo-grid"), Number(cell.getAttribute("data-rgrow")));
  };
  const onAfterfocus = (e: CustomEvent): void => {
    const d = e.detail as { rowIndex?: number; rowType?: string } | null;
    if (d && typeof d.rowIndex === "number" && (d.rowType ?? "rgRow") === "rgRow") void select(e.target as Element, d.rowIndex);
  };

  // the user dropped a row somewhere else. The grid has not moved it yet: the order lives in the
  // state, and the grid redraws from that.
  const onRoworderchanged = (e: CustomEvent): void => {
    const d = e.detail as { from: number; to: number } | null;
    e.preventDefault();
    if (!d || d.from === d.to || !state.rows[d.from] || d.to < 0 || d.to >= state.rows.length) return;
    const rows = state.rows.slice();
    rows.splice(d.to, 0, ...rows.splice(d.from, 1));
    set(["rows"], rows);
    emit("reordered", { from: d.from, to: d.to });
  };

  // a cell too narrow for its text shows the whole of it on hover
  const onMouseOver = (e: MouseEvent): void => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".rgCell, .rgHeaderCell .header-content");
    if (cell) titleWhenCut(cell);
  };

  const onContextMenu = async (e: MouseEvent): Promise<void> => {
    const cell = (e.target as HTMLElement).closest("[data-rgrow]");
    if (!cell) return;
    e.preventDefault();
    const { clientX: x, clientY: y } = e;
    const row = Number(cell.getAttribute("data-rgrow"));
    const item = await shown(cell.closest("revo-grid"), row);
    if (item) emit("contextmenu", { item, row, x, y });
  };

  return (
    <div ref={boxRef} className={puTable} onContextMenu={onContextMenu} onClick={onClick} onMouseOver={onMouseOver}>
      <RevoGrid
        columns={columns}
        source={source}
        readonly={!editable}
        range={true}
        resize={true}
        rowHeaders={true}
        theme="compact"
        stretch={true}
        hideAttribution={true}
        style={{ height }}
        onAfteredit={onAfteredit}
        onAfterfocus={onAfterfocus}
        onRoworderchanged={onRoworderchanged}
      />
    </div>
  );
}
