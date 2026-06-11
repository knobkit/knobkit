import "./menu.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ViewProps } from "../../view.js";
import type { MenuWidget, MenuItem } from "../../../lib/widgets/menu.js";

type S = { open: boolean; x: number; y: number; items: MenuItem[]; target: string | null };

export function MenuView({ widget, state, emit, set }: ViewProps<MenuWidget, S>) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });
  const close = () => set(["open"], false);

  useLayoutEffect(() => {
    if (!state.open || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      x: Math.max(4, Math.min(state.x, window.innerWidth - width - 4)),
      y: Math.max(4, Math.min(state.y, window.innerHeight - height - 4)),
    });
  }, [state.open, state.x, state.y, state.items]);

  useEffect(() => {
    if (!state.open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = () => close();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll, true);
    };
  }, [state.open]);

  if (!state.open || typeof document === "undefined") return null;

  const pick = (item: MenuItem) => {
    if (item.disabled || item.separator) return;
    set(["open"], false);
    emit(widget.selected({ action: item.id, target: state.target }));
  };

  return createPortal(
    <div ref={ref} className="pu-menu" style={{ left: pos.x, top: pos.y }} role="menu">
      {state.items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="pu-menu-sep" role="separator" />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`pu-menu-item${item.danger ? " pu-menu-item-danger" : ""}`}
            onClick={() => pick(item)}
          >
            <span className="pu-menu-icon">{item.icon ?? ""}</span>
            <span className="pu-menu-label">{item.label}</span>
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
