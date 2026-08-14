import { knobkit, text, number, button, table, chart, row, col } from "knobkit";

// Each submission becomes a table row; a derived column (deviation from the running mean) is
// recomputed across all rows and plotted — the mean shifts with every new entry.
type Entry = { label: string; value: number; deviation?: number };

const withDeviation = (rows: Entry[]): Entry[] => {
  if (rows.length === 0) return rows;
  const mean = rows.reduce((sum, r) => sum + Number(r.value), 0) / rows.length;
  return rows.map((r) => ({ ...r, deviation: Math.round((Number(r.value) - mean) * 100) / 100 }));
};

const label = text({ placeholder: "Label (e.g. Erin)" });
const value = number();
const add = button({ label: "Add entry" });

const entries = table({
  columns: [
    { key: "label", label: "Label" },
    { key: "value", label: "Value" },
    { key: "deviation", label: "Δ from mean" },
  ],
  rows: [],
});
const plot = chart({ kind: "bar", x: "label", y: "deviation", data: [] });

const app = knobkit({
  title: "Deviation explorer",
  description: "Add label/value entries; each entry's deviation from the running mean is computed and plotted.",
  widgets: col(row(label, value, add), row(entries, plot)),
});

app.on(add.clicked, async () => {
  const l = (await label.value()).trim();
  if (!l) return;
  const v = await value.value();
  // recompute the derived column over the whole set — the mean moved, so every row's deviation does
  const next = withDeviation([...((await entries.data()) as Entry[]), { label: l, value: v }]);
  entries.setRows(next);
  plot.setData(next);
  label.set("");
  value.set(0);
});

app.mount("#root");
