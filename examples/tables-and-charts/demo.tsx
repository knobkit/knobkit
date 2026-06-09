import { knobkit, text, number, button, table, chart, row, col } from "knobkit";

// A reactive form whose submissions become table rows. On each submit we compute a derived column —
// each entry's deviation from the running mean — across all rows (the mean shifts with every new
// entry), then plot that computed column as a bar chart.
type Entry = { label: string; value: number; deviation?: number };

// the derived column: each row's deviation from the mean of the whole set
const withDeviation = (rows: Entry[]): Entry[] => {
  if (rows.length === 0) return rows;
  const mean = rows.reduce((sum, r) => sum + Number(r.value), 0) / rows.length;
  return rows.map((r) => ({ ...r, deviation: Math.round((Number(r.value) - mean) * 100) / 100 }));
};

const seed = withDeviation([
  { label: "Alice", value: 18 },
  { label: "Bob", value: 30 },
  { label: "Carol", value: 24 },
  { label: "Dave", value: 12 },
]);

const label = text({ placeholder: "Label (e.g. Erin)" });
const value = number();
const add = button({ label: "Add entry" });

const entries = table({
  columns: [
    { key: "label", label: "Label" },
    { key: "value", label: "Value" },
    { key: "deviation", label: "Δ from mean" },
  ],
  rows: seed,
});
const plot = chart({ kind: "bar", x: "label", y: "deviation", data: seed });

const app = knobkit({
  title: "Deviation explorer",
  description: "Add label/value entries. Each entry's deviation from the running mean is computed as a column and plotted.",
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
  label.set(""); // clear the form for the next entry
  value.set(0);
});

app.serve();
