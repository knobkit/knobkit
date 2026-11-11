import { puDocView, puDocViewSheet } from "./doc-view.css.js";
import { puTab, puTabActive, puTabsBar } from "../tabs/tabs.css.js";
import { useMemo } from "react";
import { read, utils } from "./vendor/sheetjs/xlsx.mjs"; // SheetJS, kept in the package: see vendor/sheetjs/README.md
import Grid from "./grid.js";
import type { Column, Row } from "../table/def.js";
import type { DocProps } from "./view.js";

interface Sheet {
  name: string;
  columns: Column[];
  rows: Row[];
}

export default function XlsxDoc(props: DocProps) {
  const { bytes, state, set } = props;
  const sheets = useMemo<Sheet[]>(() => {
    const book = read(bytes, { type: "array" });
    return book.SheetNames.map((name) => {
      // cells as the file holds them: a number stays a number, text that looks like one stays text
      const cells = utils.sheet_to_json<unknown[]>(book.Sheets[name]!, { header: 1, raw: true, defval: null });
      const width = cells.reduce((w, r) => Math.max(w, r.length), 0);
      // spreadsheet lettering: A, B, … Z, AA
      const columns: Column[] = Array.from({ length: width }, (_, c) => ({ key: utils.encode_col(c) }));
      const rows = cells.map((r) => Object.fromEntries(columns.map((c, i) => [c.key, r[i] ?? null])));
      return { name, columns, rows };
    });
  }, [bytes]);

  const at = Math.min(Math.max(1, Math.round(state.page) || 1), Math.max(1, sheets.length));
  const sheet = sheets[at - 1];
  return (
    <div className={`${puDocView} ${puDocViewSheet}`} data-kind="xlsx">
      <div className={puTabsBar} role="tablist">
        {sheets.map((s, i) => (
          <button
            key={s.name}
            type="button"
            role="tab"
            aria-selected={i === at - 1}
            className={`${puTab}${i === at - 1 ? ` ${puTabActive}` : ""}`}
            onClick={() => set(["page"], i + 1)}
          >
            {s.name}
          </button>
        ))}
      </div>
      {sheet && <Grid key={sheet.name} columns={sheet.columns} rows={sheet.rows} view={props} />}
    </div>
  );
}
