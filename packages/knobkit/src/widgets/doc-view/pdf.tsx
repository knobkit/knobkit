import { puDocView, puDocViewEnd, puDocViewEndActive, puDocViewPage, puDocViewPages, puDocViewText } from "./doc-view.css.js";
import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, TextLayer } from "pdfjs-dist";
import type { PDFPageProxy, RenderTask } from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import { usePaged } from "./marks.js";
import type { DocProps } from "./view.js";

// pdf.js parses in a worker. It is built into the app's own bundle and shared by every document,
// so nothing is fetched from elsewhere and nothing depends on the browser having a PDF viewer.
GlobalWorkerOptions.workerPort ??= new PdfWorker();

const MAX_SCALE = 1.5; // of the PDF's own size (72 units to the inch)
const GUTTER = 24;

interface Sheet {
  page: PDFPageProxy;
  holder: HTMLDivElement;
  layer: TextLayer;
  canvas: HTMLCanvasElement | null;
  /** the scale the canvas was drawn at; 0 = not drawn */
  drawn: number;
  task: RenderTask | null;
}

export default function PdfDoc({ bytes, state, emit }: DocProps) {
  const host = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    const sheets: Sheet[] = [];
    let unit = 0; // the first page's width at scale 1
    let scale = 1;
    const fit = (): number => (unit && el.clientWidth ? Math.min(MAX_SCALE, Math.max(0.25, (el.clientWidth - GUTTER) / unit)) : 1);

    const draw = (s: Sheet): void => {
      if (s.drawn === scale) return;
      s.task?.cancel();
      const viewport = s.page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      const task = s.page.render({ canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
      s.task = task;
      s.drawn = scale;
      task.promise.then(
        () => {
          if (gone || s.task !== task) return;
          s.canvas?.remove();
          s.holder.prepend(canvas);
          s.canvas = canvas;
        },
        () => {
          if (s.task === task) s.drawn = 0; // cancelled or failed: draw it again when next in view
        },
      );
    };
    // a drawn page is megabytes of pixels: only the ones near the window are kept
    const drop = (s: Sheet): void => {
      s.task?.cancel();
      s.task = null;
      s.canvas?.remove();
      if (s.canvas) s.canvas.width = s.canvas.height = 0;
      s.canvas = null;
      s.drawn = 0;
    };
    const near = new Set<Sheet>();
    const watch = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const s = sheets.find((x) => x.holder === e.target);
          if (!s) continue;
          if (e.isIntersecting) {
            near.add(s);
            draw(s);
          } else {
            near.delete(s);
            drop(s);
          }
        }
      },
      { root: el, rootMargin: "100% 0px" },
    );

    const rescale = (): void => {
      const next = fit();
      if (Math.abs(next - scale) < 0.005) return;
      scale = next;
      for (const s of sheets) {
        s.holder.style.setProperty("--total-scale-factor", String(scale));
        s.layer.update({ viewport: s.page.getViewport({ scale }) });
      }
      for (const s of near) draw(s);
    };
    const resize = new ResizeObserver(rescale);
    resize.observe(el);

    // the buffer goes to the worker and is gone from here, so it gets its own copy
    const loading = getDocument({ data: bytes.slice() });
    void (async () => {
      const doc = await loading.promise;
      for (let n = 1; n <= doc.numPages && !gone; n++) {
        const page = await doc.getPage(n);
        if (gone) return;
        if (n === 1) {
          unit = page.getViewport({ scale: 1 }).width;
          scale = fit();
        }
        const viewport = page.getViewport({ scale });
        const base = page.getViewport({ scale: 1 });
        const holder = document.createElement("div");
        holder.className = puDocViewPage;
        holder.dataset["page"] = String(n);
        // sizes hang off one variable, so a change of width rescales the page and its text together
        holder.style.setProperty("--total-scale-factor", String(scale));
        holder.style.width = `calc(var(--total-scale-factor) * ${base.width}px)`;
        holder.style.height = `calc(var(--total-scale-factor) * ${base.height}px)`;
        const text = document.createElement("div");
        text.className = puDocViewText;
        holder.append(text);
        el.append(holder);
        const layer = new TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport });
        await layer.render();
        if (gone) return;
        // Without this a drag that leaves a line selects everything up to the end of the page: it
        // gives the selection somewhere to end, under the text, while the button is down.
        const end = document.createElement("div");
        end.className = puDocViewEnd;
        text.append(end);
        text.addEventListener("mousedown", () => end.classList.add(puDocViewEndActive));
        const sheet: Sheet = { page, holder, layer, canvas: null, drawn: 0, task: null };
        sheets.push(sheet);
        watch.observe(holder);
        setVersion((v) => v + 1);
      }
    })().catch((err: unknown) => {
      if (!gone) setFailed(err instanceof Error ? err.message : String(err));
    });

    const release = (): void => {
      for (const e of el.querySelectorAll(`.${puDocViewEndActive}`)) e.classList.remove(puDocViewEndActive);
    };
    document.addEventListener("mouseup", release);

    return () => {
      gone = true;
      document.removeEventListener("mouseup", release);
      watch.disconnect();
      resize.disconnect();
      for (const s of sheets) {
        s.layer.cancel();
        drop(s);
      }
      void loading.destroy();
      el.replaceChildren();
      setVersion(0);
    };
  }, [bytes]);

  usePaged({
    host,
    pages: () => [...(host.current?.children ?? [])] as HTMLElement[],
    version,
    state,
    emit,
  });

  if (failed) throw new Error(failed); // shown by the page's own view-error box
  return <div ref={host} className={`${puDocView} ${puDocViewPages}`} data-kind="pdf" data-pages={version} />;
}
