import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface ToastMessage {
  id: string;
  text: string;
  severity: "info" | "success" | "warning" | "error";
  duration?: number;
}

export interface ToastState {
  messages: ToastMessage[];
}

export interface ToastWidget extends Widget<ToastState> {
  dismissed: EventCtor<{ id: string }>;
  show(text: string, severity?: ToastMessage["severity"], duration?: number): void;
  dismiss(id: string): Promise<void>;
  clear(): void;
}

export function toast(): ToastWidget {
  return {
    type: "toast",
    state: { messages: [] },
    dismissed: event<{ id: string }>("toast.dismissed"),
    ...controls,
    show(text: string, severity: ToastMessage["severity"] = "info", duration: number = 5000): void {
      const id = Date.now() + "_" + Math.random().toString(36).slice(2);
      bound(this).edit(this, "append", ["messages"], { id, text, severity, duration });
    },
    async dismiss(id: string): Promise<void> {
      const b = bound(this);
      const messages = await b.read<ToastMessage[]>(this, ["messages"]);
      b.edit(this, "set", ["messages"], messages.filter((m) => m.id !== id));
    },
    clear(): void {
      bound(this).edit(this, "set", ["messages"], []);
    },
  };
}
