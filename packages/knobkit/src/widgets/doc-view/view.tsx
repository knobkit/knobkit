import { puDocView, puDocViewEmpty, puDocViewOther, puDocViewSize } from "./doc-view.css.js";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { isMediaRef, mediaBytes } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";
import FileView from "../file/view.js";
import ImageView from "../image/view.js";
import OutputView from "../output/view.js";
import { parseCsv } from "./csv.js";
import { kindOf, nameOf } from "./kind.js";
import type { DocSelection } from "./def.js";
import type { PagedState } from "./marks.js";

interface State extends PagedState {
  src: MediaRef | string | null;
  type: string;
  name: string;
}

/** What each kind's renderer is given. */
export interface DocProps {
  id: ViewProps["id"];
  bytes: Uint8Array<ArrayBuffer>;
  state: State;
  emit: (name: "selected", payload: DocSelection) => void;
  set: ViewProps["set"];
  slot: ViewProps["slot"];
}

// Each kind's library is its own chunk, fetched when a document of that kind is first shown.
const Pdf = lazy(() => import("./pdf.js"));
const Docx = lazy(() => import("./docx.js"));
const Pptx = lazy(() => import("./pptx.js"));
const Xlsx = lazy(() => import("./xlsx.js"));
// the table view brings RevoGrid, so CSV waits for it the same way
const Grid = lazy(() => import("./grid.js"));

type Loaded = { src: MediaRef | string; bytes: Uint8Array<ArrayBuffer> } | { src: MediaRef | string; error: string };

/** The file's bytes: from the media store, or fetched from its address. */
function useBytes(src: MediaRef | string | null, wanted: boolean): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (!src || !wanted) return;
    let gone = false;
    const get = isMediaRef(src)
      ? mediaBytes(src)
      : fetch(src).then(async (res) => {
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
          return new Uint8Array(await res.arrayBuffer());
        });
    get.then(
      (bytes) => !gone && setLoaded({ src, bytes }),
      (err: unknown) => !gone && setLoaded({ src, error: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      gone = true;
    };
  }, [src, wanted]);
  return loaded && loaded.src === src ? loaded : null;
}

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n >= 100 || Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)} ${units[u]}`;
}

export default function DocView(view: ViewProps<State>) {
  const { state } = view;
  const { src } = state;
  const kind = src ? kindOf(state) : "other";
  // an image is shown from its address; a file of another type is fetched only to learn its size
  const needsBytes = kind !== "image" && !(kind === "other" && isMediaRef(src));
  const loaded = useBytes(src, needsBytes);
  const bytes = loaded && "bytes" in loaded ? loaded.bytes : null;
  const text = useMemo(
    () => (bytes && (kind === "markdown" || kind === "text" || kind === "csv") ? new TextDecoder().decode(bytes) : ""),
    [bytes, kind],
  );
  const table = useMemo(() => {
    if (kind !== "csv") return null;
    const [head = [], ...body] = parseCsv(text);
    // a header may repeat a name or leave one empty; keys must be distinct
    const columns = head.map((label, i) => ({ key: `c${i}`, label: label || `Column ${i + 1}` }));
    return { columns, rows: body.map((r) => Object.fromEntries(columns.map((c, i) => [c.key, r[i] ?? ""]))) };
  }, [text, kind]);

  if (!src) return <div className={`${puDocView} ${puDocViewEmpty}`}>—</div>;
  // the existing widgets' own views draw what they already can; they are the root here, as in their widget
  if (kind === "image") return <ImageView {...view} props={{}} state={{ ...state, src }} />;

  const name = state.name || nameOf(src) || "file";
  if (kind === "other") {
    const length = isMediaRef(src) ? src.size : bytes?.length;
    return (
      <div className={`${puDocView} ${puDocViewOther}`} data-kind="other">
        <FileView {...view} props={{}} state={{ ...state, name, url: src }} />
        <span className={puDocViewSize}>{length === undefined ? (loaded ? "" : "…") : size(length)}</span>
      </div>
    );
  }

  if (loaded && "error" in loaded) throw new Error(`${name}: ${loaded.error}`);
  const wait = <div className={`${puDocView} ${puDocViewEmpty}`}>…</div>;
  if (!bytes) return wait;

  let body: ReactNode;
  if (kind === "markdown" || kind === "text") {
    return <OutputView {...view} props={{ format: kind }} state={{ ...state, value: text }} />;
  } else if (kind === "csv") {
    body = <Grid columns={table!.columns} rows={table!.rows} view={{ ...view, bytes }} />;
  } else {
    const Kind = kind === "pdf" ? Pdf : kind === "docx" ? Docx : kind === "pptx" ? Pptx : Xlsx;
    // a new file is a new document: nothing of the last one's pages, scroll or mark carries over
    body = <Kind key={typeof src === "string" ? src : src.$m} id={view.id} bytes={bytes} state={state} emit={view.emit} set={view.set} slot={view.slot} />;
  }
  return <Suspense fallback={wait}>{body}</Suspense>;
}
