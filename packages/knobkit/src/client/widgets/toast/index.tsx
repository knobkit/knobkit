import "./toast.css";
import { useEffect } from "react";
import type { ViewProps } from "../../view.js";
import type { ToastWidget, ToastState, ToastMessage } from "../../../lib/widgets/toast.js";

export function ToastView({ widget, state, emit }: ViewProps<ToastWidget, ToastState>) {
  const messages = state.messages ?? [];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const msg of messages) {
      const dur = msg.duration ?? 5000;
      if (dur > 0) {
        timers.push(
          setTimeout(() => {
            emit(widget.dismissed({ id: msg.id }));
          }, dur),
        );
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [messages, widget, emit]);

  if (messages.length === 0) return null;

  return (
    <div className="pu-toast-container">
      {messages.map((msg: ToastMessage) => (
        <div key={msg.id} className={`pu-toast pu-toast--${msg.severity}`}>
          <span className="pu-toast-text">{msg.text}</span>
          <button
            className="pu-toast-close"
            onClick={() => emit(widget.dismissed({ id: msg.id }))}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
