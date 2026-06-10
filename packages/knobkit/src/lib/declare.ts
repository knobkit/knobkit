import type { AppConfig, Widget } from "./types.js";

// What the browser needs to render and interact, without the server-side functions: each widget's
// key, its `type` (which view), its serializable props, and the `type` string of each event it
// exposes (so the browser can reconstruct emit-able event constructors). `serverEvents` lists the
// event types that have an `on(...)` handler the browser must route off-device.
export interface WidgetDecl {
  key: string;
  type: string;
  state: unknown;
  enabled: boolean;
  props: Record<string, unknown>;
  events: Record<string, string>;
}

export interface AppDecl {
  title?: string;
  description?: string;
  widgets: WidgetDecl[];
  root: string;
  serverEvents: string[];
  theme?: string;
  density?: string;
}

const SKIP = new Set(["state", "behavior", "view", "fold", "type", "children", "__subapp"]);

interface TreeNode {
  widget: Widget<any>;
  key: string;
  children: TreeNode[];
}

function buildTree(widgets: Widget<any> | Widget<any>[]): TreeNode {
  let n = 0;
  const visit = (w: Widget<any>): TreeNode => ({
    widget: w,
    key: `${(w.type as string) || "widget"}-${n++}`,
    children: (w.children ?? []).map(visit),
  });
  const root: Widget<any> = Array.isArray(widgets) ? ({ type: "col", state: {}, children: widgets } as Widget<any>) : widgets;
  return visit(root);
}

function flatten(node: TreeNode): TreeNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

export function widgetKeys(widgets: Widget<any> | Widget<any>[]): Map<Widget<any>, string> {
  const map = new Map<Widget<any>, string>();
  for (const node of flatten(buildTree(widgets))) map.set(node.widget, node.key);
  return map;
}

function toDecl(node: TreeNode): WidgetDecl {
  const w = node.widget;
  const props: Record<string, unknown> = {};
  const events: Record<string, string> = {};
  for (const [k, v] of Object.entries(w)) {
    if (SKIP.has(k)) continue;
    if (typeof v === "function" && typeof (v as unknown as { type?: unknown }).type === "string") {
      events[k] = (v as unknown as { type: string }).type;
    } else if (typeof v !== "function") {
      props[k] = v;
    }
  }
  const isContainer = Array.isArray(w.children);
  const state = isContainer ? { items: node.children.map((c) => c.key) } : w.state;
  return { key: node.key, type: (w.type as string | undefined) ?? "", state, enabled: true, props, events };
}

export function declare(config: AppConfig, serverEvents: string[] = []): AppDecl {
  const root = buildTree(config.widgets);
  const widgets = flatten(root).map(toDecl);
  return { title: config.title, description: config.description, widgets, root: root.key, serverEvents, theme: config.theme, density: config.density };
}
