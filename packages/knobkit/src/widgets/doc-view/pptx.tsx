import { puDocView, puDocViewNote, puDocViewPages } from "./doc-view.css.js";
import { useEffect, useRef, useState } from "react";
import { init } from "pptx-preview";
import { usePaged } from "./marks.js";
import type { DocProps } from "./view.js";

const MAX_WIDTH = 960;
const GUTTER = 24;
const SLIDE = ".pptx-preview-slide-wrapper";

/** How many slides the file holds, read from the archive the library opened; 0 when that cannot be told. */
function slidesInFile(deck: unknown): number {
  const files = (deck as { pptx?: { _zipContents?: { files?: Record<string, unknown> } } }).pptx?._zipContents?.files;
  return files ? Object.keys(files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).length : 0;
}

export default function PptxDoc({ bytes, state, emit }: DocProps) {
  const host = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState("");
  const [missing, setMissing] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    const width = Math.max(240, Math.min(MAX_WIDTH, (el.clientWidth || MAX_WIDTH) - GUTTER));
    // "list": every slide on the page, one after another
    const deck = init(el, { width, mode: "list" });
    // the library keeps the buffer, so it gets its own copy
    deck.preview(bytes.slice().buffer).then(
      () => {
        if (gone) return;
        // the library stops without a word at a slide it cannot read, and shows only those before it
        setMissing(Math.max(0, slidesInFile(deck) - el.querySelectorAll(SLIDE).length));
        setVersion((v) => v + 1);
      },
      (err: unknown) => {
        if (!gone) setFailed(err instanceof Error ? err.message : String(err));
      },
    );
    return () => {
      gone = true;
      try {
        deck.destroy();
      } catch {
        /* nothing rendered yet */
      }
      el.replaceChildren();
      setMissing(0);
      setVersion(0);
    };
  }, [bytes]);

  usePaged({
    host,
    pages: () => [...(host.current?.querySelectorAll<HTMLElement>(SLIDE) ?? [])],
    version,
    state,
    emit,
  });

  if (failed) throw new Error(failed);
  return (
    <div className={`${puDocView} ${puDocViewPages}`} data-kind="pptx" data-pages={version}>
      {missing > 0 && (
        <div className={puDocViewNote} role="alert">
          {missing === 1 ? "1 slide" : `${missing} slides`} could not be shown.
        </div>
      )}
      <div ref={host} />
    </div>
  );
}
