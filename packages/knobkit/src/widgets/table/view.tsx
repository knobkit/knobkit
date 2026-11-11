import { puTable } from "./table.css.js";
import { useMemo, useRef, useState, type MouseEvent } from "react";
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
}
type GridRow = Record<string, unknown>;

// "compact" theme metrics (from revo-grid-style.css): header row 45px, data row 32px — used to fit
// the grid to its content up to maxHeight, then scroll.
const HEADER_PX = 45;
const ROW_PX = 32;

// A column with no explicit width defaults to one that fits its *header* — the header is usually the
// wider constraint for compact tables (e.g. "Δ from mean" over numeric cells), and unlike content-based
// auto-size it stays stable as data changes. Measured with canvas for proportional-font accuracy.
const HEADER_FONT = "600 14px Helvetica, Arial, sans-serif"; // compact theme header
const COL_PAD = 34; // header cell padding + room for the sort arrow
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

interface Props {
  editable: boolean;
  maxHeight: number;
}

export default function TableView({ props, state, emit, set }: ViewProps<{ columns: Column[]; rows: Row[]; selected: number | null }, Props>) {
  const { editable, maxHeight } = props;
  // fit to content (header + rows), capped at maxHeight; +2 leaves room for a horizontal scrollbar so
  // a fitting grid doesn't sprout a vertical one
  const height = Math.min(maxHeight, HEADER_PX + state.rows.length * ROW_PX + 2);

  // RevoGrid warns that columns/source need stable references; the store hands us a fresh state object
  // only on a real edit (edits are immutable), so memoizing on those references is both stable and correct.
  const columns = useMemo<GridColumn[]>(
    () =>
      state.columns.map((c) => ({
        prop: c.key,
        name: c.label ?? c.key,
        sortable: true,
        readonly: !editable,
        size: c.width ?? headerWidth(c.label ?? c.key),
      })),
    [state.columns, editable],
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
    <div className={puTable} onContextMenu={onContextMenu} onClick={onClick}>
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
      />
    </div>
  );
}
