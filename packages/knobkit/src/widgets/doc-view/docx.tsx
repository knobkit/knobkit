import { puDocView, puDocViewPages } from "./doc-view.css.js";
import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { usePaged } from "./marks.js";
import type { DocProps } from "./view.js";

export default function DocxDoc({ bytes, state, emit }: DocProps) {
  const host = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    // rendered apart and moved in when complete, so a document replaced meanwhile never shows
    const into = document.createElement("div");
    renderAsync(bytes, into, undefined, { useBase64URL: true }).then(
      () => {
        if (gone) return;
        el.replaceChildren(...into.childNodes);
        setVersion((v) => v + 1);
      },
      (err: unknown) => {
        if (!gone) setFailed(err instanceof Error ? err.message : String(err));
      },
    );
    return () => {
      gone = true;
      el.replaceChildren();
      setVersion(0);
    };
  }, [bytes]);

  usePaged({
    host,
    // the library's own page element: one per section or page break of the file
    pages: () => [...(host.current?.querySelectorAll<HTMLElement>("section.docx") ?? [])],
    version,
    state,
    emit,
  });

  if (failed) throw new Error(failed);
  return <div ref={host} className={`${puDocView} ${puDocViewPages}`} data-kind="docx" data-pages={version} />;
}
