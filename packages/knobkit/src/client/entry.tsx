import { io } from "socket.io-client";
import type { AppDecl } from "../lib/declare.js";
import type { EditOp, Path } from "../lib/bound.js";
import { createStore, type Transport } from "./runtime.js";
import { render } from "./app.js";

// the bundled browser entry for a served app: fetch the decl, open the socket, render. A routed event
// is sent as a tiny `request` (no state). The server applies state via `edit`/`enable`, re-emits
// produced events via `emit`, and pulls state on demand via `read` (one attribute, answered here).
async function boot(): Promise<void> {
  const decl: AppDecl = await (await fetch("/api/decl")).json();
  const socket = io({ path: "/socket.io/", transports: ["polling", "websocket"] });
  const transport: Transport = (type, payload) => socket.emit("request", { type, payload });
  const store = createStore(decl, transport);

  socket.on("edit", (m: { key: string; op: EditOp; path: Path; value: unknown }) => store.applyEdit(m.key, m.op, m.path, m.value));
  socket.on("enable", (m: { key: string; value: boolean }) => store.setEnabled(m.key, m.value));
  socket.on("busy", (m: { key: string; value: boolean }) => store.setBusy(m.key, m.value));
  socket.on("emit", (m: { type: string; payload: unknown }) => store.emit(m.type, m.payload));
  socket.on("read", (m: { key: string; path: Path }, ack: (value: unknown) => void) => ack(store.read(m.key, m.path)));

  render(decl, store, document.getElementById("root")!);
}

void boot();
