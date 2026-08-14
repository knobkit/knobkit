import "./toast.css";
import { useEffect } from "react";
import type { ViewProps } from "@knobkit/core/client";
import type { Toast } from "./def.js";

const DISMISS_MS = 5000;

export default function ToastView({ state, set }: ViewProps<{ items: Toast[] }>) {
  const items = state.items ?? [];

  // auto-dismiss is a view concern: remove the item locally after a delay
  useEffect(() => {
    const timers = items.map((item) =>
      setTimeout(() => {
        set(["items"], items.filter((t) => t.key !== item.key));
      }, DISMISS_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [items, set]);

  if (items.length === 0) return null;

  return (
    <div className="pu-toast-container">
      {items.map((item) => (
        <div key={item.key} className={`pu-toast pu-toast--${item.variant}`}>
          <span className="pu-toast-text">{item.message}</span>
          <button
            className="pu-toast-close"
            onClick={() => set(["items"], items.filter((t) => t.key !== item.key))}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
