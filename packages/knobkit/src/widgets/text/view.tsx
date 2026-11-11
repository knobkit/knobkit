import "../_primitives/controls.css";
import { puInput } from "./text.css.js";
import { useLayoutEffect, useRef } from "react";
import type { ViewProps } from "@knobkit/core/client";
import { changedSpan } from "../_primitives/text-diff.js";

export default function TextView({ props, state, emit, set }: ViewProps<{ value: string }, { placeholder: string; lines: number }>) {
  const box = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const update = (v: string): void => {
    set(["value"], v); // local, so reads see what was typed
    emit("changed", v);
  };

  // The box holds its own text; a value set from outside is written into it as the one span that
  // differs. Handing the browser a whole new value puts the cursor at the end, which loses the
  // user's place whenever a handler refreshes text they are typing in.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const span = changedSpan(el.value, state.value ?? "");
    if (!span) return;
    const top = el.scrollTop;
    el.setRangeText(span.insert, span.from, span.to, "preserve");
    el.scrollTop = top;
  }, [state.value]);

  return props.lines > 1 ? (
    <textarea
      ref={box}
      className={puInput}
      rows={props.lines}
      placeholder={props.placeholder}
      defaultValue={state.value}
      onChange={(e) => update(e.currentTarget.value)}
    />
  ) : (
    <input
      ref={box}
      className={puInput}
      placeholder={props.placeholder}
      defaultValue={state.value}
      onChange={(e) => update(e.currentTarget.value)}
    />
  );
}
