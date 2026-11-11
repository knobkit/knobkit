import { useState } from "react";
import TableView from "../table/view.js";
import type { Column, Row } from "../table/def.js";
import type { DocProps } from "./view.js";

/** A table of read-only cells, drawn by the `table` widget's own view. */
export default function Grid({ columns, rows, view }: { columns: Column[]; rows: Row[]; view: DocProps }) {
  // the row the user is on is the table's own state; here it lives with the grid, and is not reported
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <TableView
      id={view.id}
      props={{ editable: false, reorderable: false, maxHeight: 500 }}
      state={{ columns, rows, selected, $enabled: true, $busy: false }}
      emit={() => {}}
      send={() => {}}
      set={(path, value) => {
        if (Array.isArray(path) && path[0] === "selected") setSelected(value as number | null);
      }}
      slot={view.slot}
    />
  );
}
