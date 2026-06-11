import { knobkit, tree, breadcrumb, table, output, text, button, row, col } from "knobkit";
import type { TreeNode } from "knobkit";

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
seed("Notes.md", "file", docs, "## Standup\n\n- shipped the tree widget\n- breadcrumb next");
const photos = seed("Photos", "folder", "root");
const trip = seed("Vacation", "folder", photos);
seed("caption.md", "file", trip, "Sunset over the bay. 🌅");
const projects = seed("Projects", "folder", "root");
const kb = seed("knobkit", "folder", projects);
seed("README.md", "file", kb, "# knobkit\n\nCreate TypeScript webapps in minutes.");
seed("ideas.md", "file", projects, "- a `menu` widget for right-click actions\n- drag to move");
seed("todo.md", "file", "root", "- [x] build drive demo\n- [ ] wire up a context menu");

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

const folderSummary = (i: Item) => {
  const kids = childrenOf(i.id);
  const folders = kids.filter((k) => k.kind === "folder").length;
  return `### ${i.name}\n\n${folders} folder(s), ${kids.length - folders} file(s).\n\nSelect a file to preview it.`;
};

const folders = tree({ nodes: [toNode(byId("root")!)], expanded: ["root"], selected: "root" });
const crumbs = breadcrumb({ crumbs: trail("root") });
const contents = table({
  columns: [
    { key: "name", label: "Name" },
    { key: "kind", label: "Kind" },
    { key: "size", label: "Size" },
    { key: "modified", label: "Modified" },
  ],
  rows: rowsFor("root"),
});
const preview = output({ format: "markdown" });
const nameInput = text({ placeholder: "New item name…" });
const newFolder = button({ label: "New folder" });
const newFile = button({ label: "New file" });

let current = "root";

const app = knobkit({
  title: "Drive",
  description: "A file browser built from tree + breadcrumb + table. The folder tree is the nav; pick a file to preview it.",
  fill: true,
  widgets: col(
    crumbs,
    row(nameInput, newFolder, newFile),
    row(folders, col(contents, preview)),
  ),
});

function showFolder(id: string) {
  current = id;
  crumbs.set(trail(id));
  contents.setRows(rowsFor(id));
  preview.set(folderSummary(byId(id)!));
}

app.on(folders.selected, ({ id }) => {
  const item = byId(id);
  if (!item) return;
  if (item.kind === "folder") return showFolder(id);
  current = item.parentId ?? "root";
  crumbs.set(trail(current));
  contents.setRows(rowsFor(current));
  preview.set(item.content ?? "*(empty file)*");
});

app.on(crumbs.selected, ({ id }) => showFolder(id));

async function create(kind: Item["kind"]) {
  const name = (await nameInput.value()).trim() || (kind === "folder" ? "Untitled folder" : "untitled.md");
  const id = `n${nextId++}`;
  FS.set(id, { id, name, kind, parentId: current, content: kind === "file" ? `# ${name}\n` : undefined, modified: today });
  folders.setNodes([toNode(byId("root")!)]);
  await folders.expand(current);
  contents.setRows(rowsFor(current));
  nameInput.set("");
}

app.on(newFolder.clicked, () => create("folder"));
app.on(newFile.clicked, () => create("file"));

app.serve();
