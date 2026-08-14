import "./accordion.css";
import type { ViewProps } from "@knobkit/core/client";

export default function AccordionView({ props, state, set, slot }: ViewProps<{ items: string[]; open: boolean }, { label: string }>) {
  const items = state.items ?? [];
  const open = state.open !== false;
  return (
    <div className={`pu-accordion${open ? " pu-accordion-open" : ""}`}>
      <button className="pu-accordion-head" aria-expanded={open} onClick={() => set(["open"], !open)}>
        <span className="pu-accordion-caret">▸</span>
        {props.label}
      </button>
      {open && <div className="pu-accordion-body">{items.map((id) => slot(id))}</div>}
    </div>
  );
}
