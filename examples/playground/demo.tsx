import { knobkit, dropdown, code, frame, row, col } from "knobkit";
import { transform } from "sucrase";
import runtimeUrl from "knobkit/browser?url";
import runtimeCss from "knobkit/browser.css?url";
import { EXAMPLES } from "./examples.js";

const importmap = JSON.stringify({ imports: { knobkit: runtimeUrl } });

const SHELL = [
  '<!doctype html><html><head><meta charset="utf-8">',
  `<link rel="stylesheet" href="${runtimeCss}">`,
  "<style>html,body{margin:0;height:100%}#err{display:none;position:fixed;left:0;right:0;bottom:0;margin:0;padding:10px 14px;background:#fde8e8;color:#9b1c1c;font:13px/1.45 ui-monospace,Menlo,monospace;border-top:1px solid #f5c2c2;white-space:pre-wrap;z-index:10}</style>",
  `<script type="importmap">${importmap}</script>`,
  '</head><body><div id="root"></div><pre id="err"></pre>',
  '<script type="module">',
  'function $e(m){var x=document.getElementById("err");x.textContent=m;x.style.display="block"}',
  'addEventListener("error",function(e){$e(e.message)});',
  'addEventListener("unhandledrejection",function(e){$e((e.reason&&e.reason.message)||String(e.reason))});',
  'addEventListener("message",function(e){',
  'if(!e.data||e.data.type!=="run")return;',
  'var x=document.getElementById("err");x.style.display="none";x.textContent="";',
  'var o=document.getElementById("root");var n=document.createElement("div");n.id="root";o.replaceWith(n);',
  'var s=document.createElement("script");s.type="module";s.textContent=e.data.code;document.body.appendChild(s)});',
  'parent.postMessage({type:"ready"},"*");',
  "</script></body></html>",
].join("");

const picker = dropdown({ choices: EXAMPLES.map((e) => e.name) });
const editor = code({ language: "typescript", value: EXAMPLES[0]!.code });
const preview = frame({ doc: SHELL, title: "preview" });

const app = knobkit({
  title: "knobkit playground",
  description: "Edit the code — it runs live on the right. Pick an example to load it.",
  widgets: row(col(picker, editor), preview),
});

let previewWin: Window | null = null;
let current = EXAMPLES[0]!.code;

function run(src: string): void {
  current = src;
  if (!previewWin) return;
  try {
    const js = transform(src, { transforms: ["typescript"], filePath: "demo.ts" }).code;
    previewWin.postMessage({ type: "run", code: js }, "*");
  } catch {
    void 0;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
function debouncedRun(src: string): void {
  clearTimeout(timer);
  timer = setTimeout(() => run(src), 400);
}

window.addEventListener("message", (ev: MessageEvent) => {
  if ((ev.data as { type?: string } | null)?.type === "ready") {
    previewWin = ev.source as Window | null;
    run(current);
  }
});

app.on(picker.changed, async (name: string) => {
  const ex = EXAMPLES.find((e) => e.name === name);
  if (!ex) return;
  editor.set(ex.code);
  run(ex.code);
});

app.on(editor.changed, async (src: string) => debouncedRun(src));

app.mount("#root");
