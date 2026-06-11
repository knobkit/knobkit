import { knobkit, tree, breadcrumb, table, button, upload, menu, span, grow, row, col } from "knobkit";
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
seed("Resume.md", "file", docs, "# Jane Doe");
seed("Notes.md", "file", docs, "## Standup");
const photos = seed("Photos", "folder", "root");
const trip = seed("Vacation", "folder", photos);
seed("caption.md", "file", trip, "Sunset over the bay.");
const projects = seed("Projects", "folder", "root");
const kb = seed("knobkit", "folder", projects);
seed("README.md", "file", kb, "# knobkit");
seed("ideas.md", "file", projects, "- drag to move");
seed("todo.md", "file", "root", "- [x] build drive demo");

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

const rowsFor = (folderId: string) =>
  childrenOf(folderId).map((i) => ({
    id: i.id,
    name: `${icon(i)}  ${i.name}`,
    kind: i.kind === "folder" ? "Folder" : "Document",
    size: i.kind === "file" ? `${(i.content ?? "").length} B` : "—",
    modified: i.modified,
  }));

const folders = tree({ nodes: [toNode(byId("root")!)], expanded: ["root"], selected: "root" });
const crumbs = breadcrumb({ crumbs: trail("root") });
const contents = table({
  columns: [
    { key: "name", label: "Name", width: 280 },
    { key: "kind", label: "Kind" },
    { key: "size", label: "Size" },
    { key: "modified", label: "Modified" },
  ],
  rows: rowsFor("root"),
  maxHeight: 4000,
});
const newFolder = button({ label: "＋ Folder" });
const newFile = button({ label: "＋ File" });
const uploader = upload({ multiple: true });
const ctx = menu();

let current = "root";

const app = knobkit({
  title: "Drive",
  description: "File tree on the left, the current folder's contents on the right. Right-click any item for actions.",
  fill: true,
  widgets: col(
    crumbs,
    ctx,
    grow(row(
      col(row(newFolder, newFile), uploader, grow(folders)),
      span(contents, 4),
    )),
  ),
});

function refresh() {
  folders.setNodes([toNode(byId("root")!)]);
  contents.setRows(rowsFor(current));
}

function showFolder(id: string) {
  current = id;
  crumbs.set(trail(id));
  contents.setRows(rowsFor(id));
}

function openItem(item: Item) {
  const folderId = item.kind === "folder" ? item.id : item.parentId ?? "root";
  showFolder(folderId);
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
  crumbs.set(trail(current));
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

app.on(folders.selected, ({ id }) => {
  const item = byId(id);
  if (item) openItem(item);
});
app.on(crumbs.selected, ({ id }) => showFolder(id));
app.on(newFolder.clicked, () => create("folder"));
app.on(newFile.clicked, () => create("file"));

app.on(uploader.changed, async (files) => {
  for (const f of files) {
    const id = `n${nextId++}`;
    const body = f.type.startsWith("image/") ? `![${f.name}](${f.url})` : `${f.name}`;
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
app.on(contents.contextmenu, ({ item, x, y }) => {
  const it = byId(item.id as string);
  if (it) ctx.open({ x, y, target: it.id, items: menuItems(it) });
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
      showFolder(item.id);
      return create("folder");
    case "newFile":
      showFolder(item.id);
      return create("file");
    case "rename": {
      for (const c of trail(target)) await folders.expand(c.id);
      folders.select(target);
      return folders.rename(target);
    }
  }
});

app.serve();
