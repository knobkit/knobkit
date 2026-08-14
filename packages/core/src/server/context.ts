import { AsyncLocalStorage } from "node:async_hooks";
import { setContextRunner } from "../context.js";
import type { Bound } from "../context.js";

const als = new AsyncLocalStorage<Bound>();

let installed = false;

export function installNodeContext(): void {
  if (installed) return;
  installed = true;
  setContextRunner(
    () => als.getStore(),
    (b, fn) => als.run(b, fn),
  );
}
