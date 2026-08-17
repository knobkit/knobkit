import { puAccordion, puAccordionBody, puAccordionCaret, puAccordionHead, puAccordionOpen } from "./accordion.css.js";
import type { ViewProps } from "@knobkit/core/client";

export default function AccordionView({ props, state, set, slot }: ViewProps<{ items: string[]; open: boolean }, { label: string }>) {
  const items = state.items ?? [];
  const open = state.open !== false;
  return (
    <div className={`${puAccordion}${open ? ` ${puAccordionOpen}` : ""}`}>
      <button className={puAccordionHead} aria-expanded={open} onClick={() => set(["open"], !open)}>
        <span className={puAccordionCaret}>▸</span>
        {props.label}
      </button>
      {open && <div className={puAccordionBody}>{items.map((id) => slot(id))}</div>}
    </div>
  );
}
