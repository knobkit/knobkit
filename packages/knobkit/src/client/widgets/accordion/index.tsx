import "./accordion.css";
import { useState } from "react";
import type { ViewProps } from "../../view.js";

export function AccordionView({ widget, state, slot }: ViewProps<any, { items: string[] }>) {
  const items = state.items ?? [];
  const [open, setOpen] = useState(widget.open !== false);
  return (
    <div className={`pu-accordion${open ? " pu-accordion-open" : ""}`}>
      <button className="pu-accordion-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="pu-accordion-caret">▸</span>
        {widget.label as string}
      </button>
      {open && <div className="pu-accordion-body">{items.map((key) => slot(key))}</div>}
    </div>
  );
}
