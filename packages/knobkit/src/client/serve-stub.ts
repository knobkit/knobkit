export function serve(): never {
  throw new Error("knobkit: serve() runs a Node server and isn't available in the browser runtime; use mount()");
}
