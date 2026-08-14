import "./overlay.css";
import { useSyncExternalStore } from "react";
import type { NotesHub } from "./notes.js";

export function NotesOverlay({ hub }: { hub: NotesHub }) {
  const notes = useSyncExternalStore(hub.subscribe, hub.list, hub.list);
  if (notes.length === 0) return null;
  return (
    <div className="pu-notes" role="log" aria-live="polite">
      {notes.map((n) => (
        <div key={n.key} className={`pu-note pu-note-${n.level}`}>
          <div className="pu-note-body">
            <span className="pu-note-msg">{n.message}</span>
            {hub.dev && n.stack && <pre className="pu-note-stack">{n.stack}</pre>}
          </div>
          <button className="pu-note-x" aria-label="Dismiss" onClick={() => hub.dismiss(n.key)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
