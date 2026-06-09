import { knobkit, dropdown, code, col } from "knobkit";
import { transform } from "sucrase";
import { EXAMPLES } from "./examples.js";

const picker = dropdown({ choices: EXAMPLES.map((e) => e.name) });
const editor = code({ language: "typescript", value: EXAMPLES[0]!.code });

const app = knobkit({
  title: "knobkit playground",
  description: "Edit the code — it runs live on the left. Pick an example to load it.",
  widgets: col(picker, editor),
});

const frame = document.getElementById("preview") as HTMLIFrameElement;
let ready = false;
let current = EXAMPLES[0]!.code;

function post(msg: unknown): void {
  frame.contentWindow?.postMessage(msg, "*");
}

function run(src: string): void {
  current = src;
  if (!ready) return;
  try {
    const js = transform(src, { transforms: ["typescript"], filePath: "demo.ts" }).code;
    post({ type: "run", code: js });
  } catch (e) {
    post({ type: "error", message: e instanceof Error ? e.message : String(e) });
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
function debouncedRun(src: string): void {
  clearTimeout(timer);
  timer = setTimeout(() => run(src), 400);
}

// the preview iframe announces itself once its runtime is listening
window.addEventListener("message", (ev: MessageEvent) => {
  if ((ev.data as { type?: string } | null)?.type === "ready") {
    ready = true;
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

app.mount("#panel");
