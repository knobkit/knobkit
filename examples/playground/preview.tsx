import * as KNOBKIT from "knobkit";

// runs the authored snippet by providing the knobkit namespace in scope and letting it mount into #root.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as {
  new (...args: string[]): (knobkit: typeof KNOBKIT) => Promise<void>;
};

function showError(message: string): void {
  const el = document.getElementById("err")!;
  el.textContent = message;
  el.style.display = "block";
}
function clearError(): void {
  const el = document.getElementById("err")!;
  el.textContent = "";
  el.style.display = "none";
}

// rewrite `import … from "knobkit"` into a binding off the supplied namespace; reject any other import.
function compile(js: string): string {
  let header = "";
  const body = js.replace(/^[ \t]*import\s+([\s\S]+?)\s+from\s+["']knobkit["'];?[ \t]*$/gm, (_m, clause: string) => {
    const c = clause.trim();
    if (c.startsWith("{")) header += `const ${c} = __knobkit__;\n`;
    else if (c.startsWith("*")) header += `const ${c.split(/\s+as\s+/)[1]!.trim()} = __knobkit__;\n`;
    else header += `const ${c} = __knobkit__.default ?? __knobkit__;\n`;
    return "";
  });
  if (/^[ \t]*import\s/m.test(body) || /^[ \t]*export\s/m.test(body)) {
    throw new Error('the playground only supports `import … from "knobkit"`');
  }
  return header + body;
}

// mount into a fresh, offscreen #root and swap it in on success; on a synchronous failure restore the
// previous render so a mid-edit error doesn't blank the preview.
async function run(js: string): Promise<void> {
  const fn = new AsyncFunction("__knobkit__", compile(js));
  const prev = document.getElementById("root");
  const next = document.createElement("div");
  next.id = "root";
  next.style.cssText = "position:absolute; left:-99999px; top:0; width:100%; height:100%;";
  if (prev) prev.id = "root-prev";
  document.body.appendChild(next);
  try {
    await fn(KNOBKIT);
    next.style.cssText = "";
    prev?.remove();
    clearError();
  } catch (e) {
    next.remove();
    if (prev) prev.id = "root";
    throw e;
  }
}

window.addEventListener("message", (ev: MessageEvent) => {
  const m = ev.data as { type?: string; code?: string; message?: string } | null;
  if (m?.type === "run") {
    run(String(m.code)).catch((e) => showError(e instanceof Error ? e.message : String(e)));
  } else if (m?.type === "error") {
    showError(String(m.message)); // a transpile error from the editor — keep the last good render
  }
});

parent.postMessage({ type: "ready" }, "*");
