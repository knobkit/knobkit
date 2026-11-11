import { afterEach, describe, expect, test } from "vitest";
import {
  accordion, chat, code, col, diff, drawer, grid, grow, knobkit, log, output, row, sidebar, splitPane, statusBadge,
  table, tabs, terminal, toolbar, tree,
} from "../../index.js";

// Every widget is given far more content than fits, so a widget that is not held to the height
// it is offered shows up as one that runs past its container.
const LONG = 120;

interface Made {
  root: unknown;
  fillers: (() => void)[];
  /** how many of each widget root the page must show before it is measured */
  expected: Map<string, number>;
}

function build(make: (w: Tools) => unknown): Made {
  const fillers: (() => void)[] = [];
  const expected = new Map<string, number>();
  let counting = true;
  const seen = <T,>(selector: string, widget: T): T => {
    if (counting) expected.set(selector, (expected.get(selector) ?? 0) + 1);
    return widget;
  };
  const made: Kit = {
    chat() {
      const c = chat();
      fillers.push(() => {
        for (let i = 0; i < 40; i++) c.say({ role: i % 2 ? "assistant" : "user", content: `Message ${i}, long enough to scroll.` });
      });
      return c;
    },
    code() {
      const c = code();
      fillers.push(() => c.set(Array.from({ length: LONG }, (_, i) => `const line${i} = ${i};`).join("\n")));
      return c;
    },
    table() {
      const t = table();
      fillers.push(() => {
        t.setColumns([{ key: "a" }, { key: "b" }]);
        t.setRows(Array.from({ length: LONG }, (_, i) => ({ a: i, b: `row ${i}` })));
      });
      return t;
    },
    term() {
      const t = terminal();
      fillers.push(() => t.write(Array.from({ length: LONG }, (_, i) => `line ${i}\r\n`).join("")));
      return t;
    },
    tree: () => tree([{ id: "src", label: "src", children: Array.from({ length: LONG }, (_, i) => ({ id: `f${i}`, label: `file-${i}.ts` })) }]),
    log() {
      const l = log();
      fillers.push(() => {
        for (let i = 0; i < LONG; i++) l.push(`log line ${i}`);
      });
      return l;
    },
    diff() {
      const d = diff();
      const lines = (p: string): string => Array.from({ length: LONG }, (_, i) => `${p}${i}`).join("\n");
      fillers.push(() => d.setFiles([{ path: "src/a.ts", status: "modified", oldContent: lines("a"), newContent: lines("b") }]));
      return d;
    },
    out() {
      const o = output();
      fillers.push(() => o.set(Array.from({ length: LONG }, (_, i) => `output line ${i}`).join("\n")));
      return o;
    },
    md() {
      const o = output({ format: "markdown" });
      fillers.push(() => o.set(Array.from({ length: LONG }, (_, i) => `Paragraph ${i}.`).join("\n\n")));
      return o;
    },
    bar: () => toolbar({ items: [{ id: "a", label: "New" }, { id: "b", label: "Refresh" }] }),
    badge: () => statusBadge("idle"),
    nav: () => sidebar([{ label: "Agents", items: [{ id: "1", label: "one" }] }]),
  };
  const kit = Object.fromEntries(
    Object.entries(made).map(([k, f]) => [k, () => seen(ROOTS[k as keyof Kit], (f as () => unknown)())]),
  ) as unknown as Kit;
  const all: Tools = {
    ...kit,
    hidden(makeHidden) {
      counting = false;
      const widget = makeHidden();
      counting = true;
      return widget;
    },
  };
  return { root: make(all), fillers, expected };
}

interface Kit {
  chat(): unknown; code(): unknown; table(): unknown; term(): unknown; tree(): unknown; log(): unknown;
  diff(): unknown; out(): unknown; md(): unknown; bar(): unknown; badge(): unknown; nav(): unknown;
}
interface Tools extends Kit {
  /** a widget the layout does not show at first (a tab that is not the open one) */
  hidden(make: () => unknown): unknown;
}

const ROOTS: Record<keyof Kit, string> = {
  chat: ".pu-chat", code: ".pu-code .cm-editor", table: ".pu-table revo-grid", term: ".pu-terminal .xterm", tree: ".pu-tree",
  log: ".pu-log", diff: ".pu-diff", out: ".pu-output", md: ".pu-md", bar: ".pu-toolbar", badge: ".pu-status-badge", nav: ".pu-sidebar",
};

// the root element of each widget that should hold the height it is offered…
const FILLS = [".pu-chat", ".pu-code", ".pu-table", ".pu-terminal", ".pu-tree", ".pu-log", ".pu-diff", ".pu-output", ".pu-md"];
// …and of those that keep their own height
const FIXED = [".pu-toolbar", ".pu-status-badge", ".pu-composer"];

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function show(make: (w: Tools) => unknown, fill = true): Promise<void> {
  const { root, fillers, expected } = build(make);
  const app = knobkit({ title: "Layout", fill, widgets: root as never });
  app.setup(() => {
    for (const f of fillers) f();
  });
  document.body.innerHTML = '<div id="root"></div>';
  app.mount("#root");
  // settled: every widget has rendered, and the page measures the same twice running
  const missing = (): string[] => [...expected].filter(([sel, n]) => document.querySelectorAll(sel).length !== n).map(([sel]) => sel);
  const measure = (): string => [...document.querySelectorAll(".pu-field > *")].map((e) => Math.round(e.getBoundingClientRect().height)).join(",");
  let last = "";
  for (let i = 0; i < 150; i++) {
    await sleep(50);
    if (missing().length) continue;
    const now = measure();
    if (now === last) return;
    last = now;
  }
  const errors = [...document.querySelectorAll(".pu-view-error")].map((e) => e.textContent);
  throw new Error(`the page did not settle; missing ${missing().join(", ") || "nothing"}; view errors: ${errors.join("; ") || "none"}`);
}

interface Box {
  what: string;
  top: number;
  bottom: number;
  height: number;
  /** the lowest point an ancestor lets this element be seen at */
  limit: number;
}

function boxes(selectors: string[]): Box[] {
  return selectors.flatMap((s) =>
    [...document.querySelectorAll<HTMLElement>(s)].map((e) => {
      const b = e.getBoundingClientRect();
      let limit = innerHeight;
      for (let p = e.parentElement; p; p = p.parentElement) {
        if (getComputedStyle(p).overflowY !== "visible") limit = Math.min(limit, p.getBoundingClientRect().bottom);
      }
      return { what: s, top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height), limit: Math.round(limit) };
    }),
  );
}

/** What is wrong with the page as laid out; empty when nothing is. */
function faults(): string[] {
  const out: string[] = [];
  if (document.documentElement.scrollHeight > innerHeight + 1) out.push("the page scrolls");
  for (const b of boxes(FILLS)) {
    if (b.height < 60) out.push(`${b.what} is ${b.height}px tall`);
    if (b.bottom > b.limit + 1) out.push(`${b.what} runs to ${b.bottom}, past its container at ${b.limit}`);
  }
  for (const b of boxes(FIXED)) {
    if (b.height < 10) out.push(`${b.what} is ${b.height}px tall`);
    if (b.bottom > b.limit + 1) out.push(`${b.what} is cut off at ${b.limit}`);
  }
  // siblings in a column do not draw over each other
  for (const column of document.querySelectorAll(".pu-layout-col")) {
    const kids = [...column.children].map((k) => k.firstElementChild).filter((k): k is Element => k != null);
    for (let i = 1; i < kids.length; i++) {
      const above = kids[i - 1]!.getBoundingClientRect();
      const below = kids[i]!.getBoundingClientRect();
      if (below.top < above.bottom - 1) out.push(`${kids[i]!.className} starts at ${Math.round(below.top)}, inside ${kids[i - 1]!.className} which ends at ${Math.round(above.bottom)}`);
    }
  }
  return out;
}

const heightOf = (s: string): number => Math.round(document.querySelector(s)!.getBoundingClientRect().height);

afterEach(() => {
  document.body.innerHTML = "";
  delete document.documentElement.dataset["fill"];
});

describe("in a page that fills the window, every widget is held to the height it is offered", () => {
  const cases: Record<string, (w: Tools) => unknown> = {
    "chat": (w) => w.chat(),
    "col(chat)": (w) => col(w.chat()),
    "col(bar, chat)": (w) => col(w.bar(), w.chat()),
    "col(bar, grow(chat))": (w) => col(w.bar(), grow(w.chat())),
    "col(chat, code)": (w) => col(w.chat(), w.code()),
    "col(code, term)": (w) => col(w.code(), w.term()),
    "col(bar, row(chat, code))": (w) => col(w.bar(), row(w.chat(), w.code())),
    "col(row(chat, code), term)": (w) => col(row(w.chat(), w.code()), w.term()),
    "col(bar, splitPane(chat, code))": (w) => col(w.bar(), splitPane(w.chat(), w.code())),
    "col(bar, grow(splitPane(chat, code)))": (w) => col(w.bar(), grow(splitPane(w.chat(), w.code()))),
    "col(accordion(chat), code)": (w) => col(accordion({ label: "Chat" }, w.chat()), w.code()),
    "row(chat, code)": (w) => row(w.chat(), w.code()),
    "grid(chat, code, table, term)": (w) => grid([w.chat(), w.code(), w.table(), w.term()], { cols: 2 }),
    "splitPane(chat, code)": (w) => splitPane(w.chat(), w.code()),
    "splitPane(col(chat), code)": (w) => splitPane(col(w.chat()), w.code()),
    "splitPane(col(bar, chat), code)": (w) => splitPane(col(w.bar(), w.chat()), w.code()),
    "splitPane(col(chat, badge), code)": (w) => splitPane(col(w.chat(), w.badge()), w.code()),
    "splitPane(col(grow(chat), badge), code)": (w) => splitPane(col(grow(w.chat()), w.badge()), w.code()),
    "splitPane(col(grow(chat), out), code)": (w) => splitPane(col(grow(w.chat()), w.out()), w.code()),
    "splitPane(col(col(bar, chat)), code)": (w) => splitPane(col(col(w.bar(), w.chat())), w.code()),
    "splitPane(chat, col(code, term))": (w) => splitPane(w.chat(), col(w.code(), w.term())),
    "splitPane(chat, col(diff, log))": (w) => splitPane(w.chat(), col(w.diff(), w.log())),
    "splitPane(chat, row(code, table))": (w) => splitPane(w.chat(), row(w.code(), w.table())),
    "splitPane(chat, grid(code, table, term, tree))": (w) => splitPane(w.chat(), grid([w.code(), w.table(), w.term(), w.tree()], { cols: 2 })),
    "splitPane(chat, vertical splitPane(code, term))": (w) => splitPane(w.chat(), splitPane(w.code(), w.term(), { direction: "vertical" })),
    "splitPane(accordion(chat), code)": (w) => splitPane(accordion({ label: "Chat" }, w.chat()), w.code()),
    "splitPane(log, diff)": (w) => splitPane(w.log(), w.diff()),
    "splitPane(out, code)": (w) => splitPane(w.out(), w.code()),
    "splitPane(md, code)": (w) => splitPane(w.md(), w.code()),
    "drawer(tree, col(bar, md))": (w) => drawer(w.tree(), col(w.bar(), w.md())),
    "splitPane(col(log), code)": (w) => splitPane(col(w.log()), w.code()),
    "row(nav, splitPane(tree, tabs(chat, code)))": (w) => row(w.nav(), splitPane(w.tree(), tabs([{ label: "Chat", content: w.chat() }, { label: "Code", content: w.hidden(() => w.code()) }]), { ratio: 0.2 })),
    "tabs(chat, code)": (w) => tabs([{ label: "Chat", content: w.chat() }, { label: "Code", content: w.hidden(() => w.code()) }]),
    "tabs(col(bar, chat))": (w) => tabs([{ label: "Chat", content: col(w.bar(), w.chat()) }]),
    "tabs(splitPane(chat, code))": (w) => tabs([{ label: "Both", content: splitPane(w.chat(), w.code()) }]),
    "drawer(tree, chat)": (w) => drawer(w.tree(), w.chat()),
    "drawer(tree, col(bar, chat))": (w) => drawer(w.tree(), col(w.bar(), w.chat())),
    "drawer(col(bar, tree), splitPane(chat, code))": (w) => drawer(col(w.bar(), w.tree()), splitPane(w.chat(), w.code())),
  };
  for (const [name, make] of Object.entries(cases)) {
    test(name, async () => {
      await show(make);
      expect(faults()).toEqual([]);
    });
  }
});

test("a chat held to a height shows the end of the conversation", async () => {
  await show((w) => splitPane(w.chat(), col(w.diff(), w.log())));
  const list = document.querySelector(".pu-chat-messages")!;
  expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
  expect(list.scrollHeight - list.scrollTop - list.clientHeight).toBeLessThan(2);
});

test("widgets that fill share a column evenly, whatever their content", async () => {
  await show((w) => col(w.code(), w.term()));
  expect(Math.abs(heightOf(".pu-code") - heightOf(".pu-terminal"))).toBeLessThan(8);
  await show((w) => splitPane(w.bar(), col(w.chat(), w.code(), w.log())));
  const [a, b, c] = [heightOf(".pu-chat"), heightOf(".pu-code"), heightOf(".pu-log")];
  expect(Math.max(a, b, c) - Math.min(a, b, c)).toBeLessThan(8);
});

test("grow() gives one child the leftover and the others their own height", async () => {
  await show((w) => splitPane(col(w.bar(), grow(w.chat()), w.badge()), w.code()));
  expect(faults()).toEqual([]);
  const panel = document.querySelector(".pu-split-pane-panel")!.getBoundingClientRect();
  const used = heightOf(".pu-toolbar") + heightOf(".pu-chat") + heightOf(".pu-status-badge");
  expect(used).toBeGreaterThan(panel.height * 0.9);
});

describe("on an ordinary page, nothing collapses and the page scrolls", () => {
  const cases: Record<string, (w: Tools) => unknown> = {
    "col(bar, chat, code, term, log)": (w) => col(w.bar(), w.chat(), w.code(), w.term(), w.log()),
    "col(bar, grow(chat), out)": (w) => col(w.bar(), grow(w.chat()), w.out()),
    "row(chat, code)": (w) => row(w.chat(), w.code()),
    "grid(chat, code, table, term)": (w) => grid([w.chat(), w.code(), w.table(), w.term()], { cols: 2 }),
    "splitPane(col(bar, chat), code)": (w) => splitPane(col(w.bar(), w.chat()), w.code()),
    "tabs(col(bar, chat))": (w) => tabs([{ label: "Chat", content: col(w.bar(), w.chat()) }]),
    "col(accordion(chat), code)": (w) => col(accordion({ label: "Chat" }, w.chat()), w.code()),
  };
  for (const [name, make] of Object.entries(cases)) {
    test(name, async () => {
      await show(make, false);
      const small = boxes([...FILLS, ...FIXED]).filter((b) => b.height < (FIXED.includes(b.what) ? 10 : 60));
      expect(small.map((b) => `${b.what} is ${b.height}px tall`)).toEqual([]);
    });
  }
});
