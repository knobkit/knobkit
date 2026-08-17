import { puToast, puToastClose, puToastContainer, puToastText } from "./toast.css.js";
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
    <div className={puToastContainer}>
      {items.map((item) => (
        <div key={item.key} className={`${puToast} pu-toast--${item.variant}`}>
          <span className={puToastText}>{item.message}</span>
          <button
            className={puToastClose}
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
