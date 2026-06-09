import { test, expect } from "vitest";
import { knobkit } from "./knobkit.js";
import { declare } from "./declare.js";
import { text, button, output, row, col, grid } from "./widgets/index.js";

test("an authored array becomes an implicit col whose items reference the children", () => {
  const a = text();
  const b = output();
  const app = knobkit({ widgets: [a, b] });
  const decl = declare(app.config);

  const root = decl.widgets.find((w) => w.key === decl.root)!;
  expect(root.type).toBe("col");
  expect((root.state as { items: string[] }).items).toEqual([app.keyFor(a), app.keyFor(b)]);
  expect(decl.widgets.find((w) => w.key === app.keyFor(a))!.state).toEqual({ value: "" });
});

test("nested containers lower to a flat decl with items refs at each level", () => {
  const size = text();
  const go = button({ label: "Go" });
  const caption = output();
  const app = knobkit({ widgets: col(row(size, go), caption) });
  const decl = declare(app.config);

  const root = decl.widgets.find((w) => w.key === decl.root)!;
  expect(root.type).toBe("col");
  const [rowKey, captionKey] = (root.state as { items: string[] }).items;
  expect(captionKey).toBe(app.keyFor(caption));

  const rowDecl = decl.widgets.find((w) => w.key === rowKey)!;
  expect(rowDecl.type).toBe("row");
  expect((rowDecl.state as { items: string[] }).items).toEqual([app.keyFor(size), app.keyFor(go)]);

  expect(decl.widgets).toHaveLength(5);
});

test("grid carries its cols as a prop and items refs", () => {
  const a = text();
  const b = text();
  const app = knobkit({ widgets: grid([a, b], { cols: 3 }) });
  const decl = declare(app.config);
  const root = decl.widgets.find((w) => w.key === decl.root)!;
  expect(root.type).toBe("grid");
  expect(root.props.cols).toBe(3);
  expect((root.state as { items: string[] }).items).toEqual([app.keyFor(a), app.keyFor(b)]);
});
