export function serveApp(): never {
  throw new Error("knobkit: serve() runs a Node server and isn't available in the browser — use mount()");
}
