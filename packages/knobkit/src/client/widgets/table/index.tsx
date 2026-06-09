// table.css is imported by ./lazy.tsx (the static entry wrapper) so it lands in client.css, not a
// split css chunk serve() wouldn't route.
import { useMemo } from "react";
import { RevoGrid, type AfterEditEvent, type ColumnRegular, type DataType } from "@revolist/react-datagrid";
import type { ViewProps } from "../../view.js";
import type { TableWidget, Column, Row } from "../../../lib/widgets/table.js";

// "compact" theme metrics (from revo-grid-style.css): header row 45px, data row 32px. Used to fit the
// grid to its content up to maxHeight, then scroll — matching Gradio's max_height behavior.
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

export function TableView({ widget, state, emit, set }: ViewProps<TableWidget, { columns: Column[]; rows: Row[] }>) {
  const editable = (widget.editable as boolean) ?? false;
  const maxHeight = (widget.maxHeight as number) ?? 500;
  // fit to content (header + rows), capped at maxHeight; +2 leaves room for a horizontal scrollbar so
  // a fitting grid doesn't sprout a vertical one
  const height = Math.min(maxHeight, HEADER_PX + state.rows.length * ROW_PX + 2);

  // RevoGrid warns that columns/source need stable references; the store hands us a fresh state object
  // only on a real edit (edits are immutable), so memoizing on those references is both stable and correct.
  const columns = useMemo<ColumnRegular[]>(
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
  const source = useMemo<DataType[]>(() => state.rows.map((r) => ({ ...r })), [state.rows]);

  const apply = (row: number, key: string, value: unknown): void => {
    // a range/paste commit reports every cell in the selection; skip the ones that didn't change so
    // handlers don't see no-op edits
    if (state.rows[row]?.[key] === value) return;
    set(["rows", row, key], value); // local edit by path; reads reflect it immediately
    emit(widget.edited({ row, key, value }));
  };

  const onAfteredit = (e: CustomEvent<AfterEditEvent>): void => {
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

  return (
    <div className="pu-table">
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
      />
    </div>
  );
}
