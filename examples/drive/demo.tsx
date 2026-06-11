import { knobkit, tree, breadcrumb, output, button, upload, menu, span, grow, row, col } from "knobkit";
import type { TreeNode, MenuItem } from "knobkit";

interface Item {
  id: string;
  name: string;
  kind: "folder" | "file";
  parentId: string | null;
  content?: string;
  modified: string;
}

const today = new Date().toISOString().slice(0, 10);

const FS = new Map<string, Item>();
let nextId = 1;
function seed(name: string, kind: Item["kind"], parentId: string | null, content?: string, id?: string): string {
  const realId = id ?? `n${nextId++}`;
  FS.set(realId, { id: realId, name, kind, parentId, content, modified: "2026-05-12" });
  return realId;
}

seed("My Drive", "folder", null, undefined, "root");
const docs = seed("Documents", "folder", "root");
seed("Resume.md", "file", docs, "# Jane Doe\n\nSenior engineer. Builds things that ship.");
seed("Notes.md", "file", docs, "## Standup\n\n- shipped the tree widget\n- collapsible sidebar next");
const photos = seed("Photos", "folder", "root");
const trip = seed("Vacation", "folder", photos);
seed("caption.md", "file", trip, "Sunset over the bay. 🌅");
const projects = seed("Projects", "folder", "root");
const kb = seed("knobkit", "folder", projects);
seed("README.md", "file", kb, "# knobkit\n\nCreate TypeScript webapps in minutes.");
seed("ideas.md", "file", projects, "- a context menu for actions\n- drag to move");
seed("todo.md", "file", "root", "## Todo\n\n- [x] build drive demo\n- [x] collapsible sidebar");

const byId = (id: string) => FS.get(id);
const childrenOf = (parentId: string) =>
  [...FS.values()]
    .filter((i) => i.parentId === parentId)
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1));

const icon = (i: Item) => (i.kind === "folder" ? "📁" : "📝");

const toNode = (i: Item): TreeNode =>
  i.kind === "folder"
    ? { id: i.id, label: i.name, icon: icon(i), children: childrenOf(i.id).map(toNode) }
    : { id: i.id, label: i.name, icon: icon(i) };

function trail(id: string) {
  const out: { id: string; label: string }[] = [];
  for (let cur = byId(id); cur; cur = cur.parentId ? byId(cur.parentId) : undefined) out.unshift({ id: cur.id, label: cur.name });
  return out;
}

function folderSummary(i: Item) {
  const kids = childrenOf(i.id);
  const folders = kids.filter((k) => k.kind === "folder").length;
  return `### ${i.name}\n\n${folders} folder(s), ${kids.length - folders} file(s).\n\nPick a file in the tree to read it.`;
}

const folders = tree({ nodes: [toNode(byId("root")!)], expanded: ["root"], selected: "root" });
const crumbs = breadcrumb({ crumbs: trail("root") });
const viewer = output({ format: "markdown" });
const newFolder = button({ label: "＋ Folder" });
const newFile = button({ label: "＋ File" });
const uploader = upload({ multiple: true });
const toggle = button({ label: "☰" });
const ctx = menu();

const sidebar = col(row(newFolder, newFile), uploader, grow(folders));
const main = row(sidebar, span(viewer, 4));

let current = "root";
let collapsed = false;

const app = knobkit({
  title: "Drive",
  description: "A file tree on the left; pick a file to read it. Toggle ☰ to collapse the sidebar.",
  fill: true,
  widgets: col(
    ctx,
    row(toggle, span(crumbs, 14)),
    grow(main),
  ),
});

app.setup(() => showFolderView("root"));

function refresh() {
  folders.setNodes([toNode(byId("root")!)]);
}

function showFolderView(id: string) {
  current = id;
  crumbs.set(trail(id));
  viewer.set(folderSummary(byId(id)!));
}

function showFileView(item: Item) {
  current = item.parentId ?? "root";
  crumbs.set(trail(item.id));
  viewer.set(`### ${item.name}\n\n${item.content ?? "*(empty file)*"}`);
}

function openItem(item: Item) {
  if (item.kind === "folder") return showFolderView(item.id);
  showFileView(item);
}

function removeItem(id: string) {
  if (id === "root") return;
  const parent = byId(id)?.parentId ?? "root";
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of childrenOf(cur)) stack.push(c.id);
    FS.delete(cur);
  }
  if (!byId(current)) current = byId(parent) ? parent : "root";
  refresh();
  showFolderView(current);
}

function menuItems(item: Item): MenuItem[] {
  if (item.kind === "folder")
    return [
      { id: "open", label: "Open", icon: "📂" },
      { id: "newFolder", label: "New folder", icon: "📁" },
      { id: "newFile", label: "New file", icon: "📝" },
      { id: "sep", label: "", separator: true },
      { id: "rename", label: "Rename", icon: "✏️" },
      { id: "delete", label: "Delete", icon: "🗑", danger: true, disabled: item.id === "root" },
    ];
  return [
    { id: "open", label: "Open", icon: "📂" },
    { id: "sep", label: "", separator: true },
    { id: "rename", label: "Rename", icon: "✏️" },
    { id: "delete", label: "Delete", icon: "🗑", danger: true },
  ];
}

async function create(kind: Item["kind"]) {
  const id = `n${nextId++}`;
  const name = kind === "folder" ? "Untitled folder" : "Untitled file";
  FS.set(id, { id, name, kind, parentId: current, content: kind === "file" ? `# ${name}\n` : undefined, modified: today });
  refresh();
  await folders.expand(current);
  folders.select(id);
  folders.rename(id);
}

app.on(toggle.clicked, () => {
  collapsed = !collapsed;
  if (collapsed) main.show(viewer);
  else main.show(sidebar, viewer);
});

app.on(folders.selected, ({ id }) => {
  const item = byId(id);
  if (item) openItem(item);
});
app.on(crumbs.selected, ({ id }) => showFolderView(id));
app.on(newFolder.clicked, () => create("folder"));
app.on(newFile.clicked, () => create("file"));

app.on(uploader.changed, async (files) => {
  for (const f of files) {
    const id = `n${nextId++}`;
    const body = f.type.startsWith("image/") ? `![${f.name}](${f.url})` : `**${f.name}**`;
    FS.set(id, { id, name: f.name, kind: "file", parentId: current, content: body, modified: today });
  }
  refresh();
  await folders.expand(current);
  uploader.clear();
});

app.on(folders.contextmenu, ({ id, x, y }) => {
  const item = byId(id);
  if (item) ctx.open({ x, y, target: id, items: menuItems(item) });
});

app.on(folders.renamed, ({ id, name }) => {
  const item = byId(id);
  if (!item) return;
  item.name = name;
  refresh();
});

app.on(ctx.selected, async ({ action, target }) => {
  if (!target) return;
  const item = byId(target);
  if (!item) return;
  switch (action) {
    case "open":
      return openItem(item);
    case "delete":
      return removeItem(target);
    case "newFolder":
      showFolderView(item.id);
      return create("folder");
    case "newFile":
      showFolderView(item.id);
      return create("file");
    case "rename": {
      for (const c of trail(target)) await folders.expand(c.id);
      folders.select(target);
      return folders.rename(target);
    }
  }
});

app.serve();
