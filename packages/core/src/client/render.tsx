import { puDesc, puPage } from "./styles.css.js";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { setDensity, setTheme } from "../theme.js";
import { APP_ID } from "../types.js";
import { Field } from "./field.js";
import type { FieldRuntime } from "./field.js";
import { NotesOverlay } from "./overlay.js";
import type { NotesHub } from "./notes.js";

interface AppState {
  root?: string;
  title?: string;
  description?: string;
  theme?: string;
  density?: string;
  fill?: boolean;
}

function Root({ runtime, notes }: { runtime: FieldRuntime; notes: NotesHub }) {
  const { store } = runtime;
  const subscribe = useCallback((cb: () => void) => store.subscribe(APP_ID, cb), [store]);
  const app = (useSyncExternalStore(subscribe, () => store.get(APP_ID), () => store.get(APP_ID))?.state ?? {}) as AppState;

  useEffect(() => {
    if (app.theme) setTheme(app.theme);
    if (app.density) setDensity(app.density);
    if (typeof document !== "undefined") {
      if (app.fill) document.documentElement.dataset["fill"] = "";
      else delete document.documentElement.dataset["fill"];
    }
  }, [app.theme, app.density, app.fill]);

  return (
    <>
      <div className={puPage}>
        {app.title && <h1>{app.title}</h1>}
        {app.description && <p className={puDesc}>{app.description}</p>}
        {/* the page is the outermost distributing container: in fill mode it has the viewport's
            height to offer, otherwise the root's `fill` degrades to intrinsic on its own */}
        {app.root && <Field id={app.root} runtime={runtime} distributed />}
      </div>
      <NotesOverlay hub={notes} />
    </>
  );
}

export function renderApp(runtime: FieldRuntime, notes: NotesHub, el: Element): void {
  createRoot(el).render(<Root runtime={runtime} notes={notes} />);
}
