import { puTerminal, puTerminalDisabled } from "./terminal.css.js";
import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { ViewProps } from "@knobkit/core/client";

export interface TerminalState {
  buffer: string;
}

export interface TerminalProps {
  rows: number;
  cols: number;
  scrollback: number;
  echo: boolean;
}

// Map knobkit design tokens to an xterm.js ITheme, resolved at mount time (xterm draws to canvas,
// so it can't follow the CSS cascade).
function resolveTheme(container: HTMLElement): Record<string, string> {
  const s = getComputedStyle(container);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    background: v("--pu-field") || v("--pu-bg") || "#1e1e2e",
    foreground: v("--pu-text") || "#cdd6f4",
    cursor: v("--pu-accent") || "#89b4fa",
    cursorAccent: v("--pu-field") || v("--pu-bg") || "#1e1e2e",
    selectionBackground: v("--pu-accent-subtle") || "rgba(137,180,250,0.25)",
    selectionForeground: v("--pu-text") || "#cdd6f4",
    // ANSI color palette — fall back to Catppuccin Mocha if tokens are absent
    black: v("--pu-series-8") || "#45475a",
    red: v("--pu-danger") || "#f38ba8",
    green: v("--pu-series-2") || "#a6e3a1",
    yellow: v("--pu-series-3") || "#f9e2af",
    blue: v("--pu-series-1") || "#89b4fa",
    magenta: v("--pu-series-4") || "#cba6f7",
    cyan: v("--pu-series-5") || "#94e2d5",
    white: v("--pu-text") || "#cdd6f4",
    brightBlack: v("--pu-muted") || "#585b70",
    brightRed: "#f38ba8",
    brightGreen: "#a6e3a1",
    brightYellow: "#f9e2af",
    brightBlue: "#89b4fa",
    brightMagenta: "#cba6f7",
    brightCyan: "#94e2d5",
    brightWhite: "#ffffff",
  };
}

export default function XtermView({ props, state, emit, set }: ViewProps<TerminalState, TerminalProps>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  // Track how much of `buffer` we've already written into the terminal so that on each state
  // update we only write the *new* bytes, avoiding duplication.
  const lastLenRef = useRef(0);
  // The onData callback is bound once; these refs let it see current values across renders.
  const enabledRef = useRef(true);
  enabledRef.current = state.$enabled !== false;
  const bufferRef = useRef(state.buffer);
  bufferRef.current = state.buffer;
  const setRef = useRef(set);
  setRef.current = set;

  // --- mount / unmount ---
  useEffect(() => {
    const container = hostRef.current!;

    const term = new Terminal({
      rows: props.rows,
      cols: props.cols,
      scrollback: props.scrollback,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.35,
      theme: resolveTheme(container),
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    termRef.current = term;

    // Write any initial buffer content that arrived before mount.
    if (bufferRef.current.length > 0) {
      term.write(bufferRef.current);
      lastLenRef.current = bufferRef.current.length;
    }

    // User input → data event; with echo, also write it locally and keep `buffer` in sync
    const dataSub = term.onData((data) => {
      if (!enabledRef.current) return;
      if (props.echo) {
        const text = data.replaceAll("\r", "\r\n");
        term.write(text);
        const next = bufferRef.current + text;
        // already on screen — advance the watermark so the state sync below doesn't re-write it
        lastLenRef.current = next.length;
        bufferRef.current = next; // rapid keystrokes compound before the next render
        setRef.current(["buffer"], next);
      }
      emit("data", data);
    });

    // Resize → resized event
    const resizeSub = term.onResize(({ cols, rows }) => {
      emit("resized", { cols, rows });
    });

    // Refit on window resize
    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);

    // Also observe the container itself for layout shifts (e.g. panel resize)
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => fit.fit());
      ro.observe(container);
    }

    return () => {
      dataSub.dispose();
      resizeSub.dispose();
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      term.dispose();
      termRef.current = null;
      lastLenRef.current = 0;
    };
    // mount once; buffer sync happens in the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- sync buffer → terminal ---
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const buf = state.buffer;
    if (buf.length === 0 && lastLenRef.current > 0) {
      // Buffer was cleared (clear()) — wipe the terminal screen
      term.clear();
      term.reset();
      lastLenRef.current = 0;
      return;
    }

    if (buf.length > lastLenRef.current) {
      // Write only the new portion of the buffer
      term.write(buf.slice(lastLenRef.current));
      lastLenRef.current = buf.length;
    } else if (buf.length < lastLenRef.current && buf.length > 0) {
      // Buffer was replaced with something shorter — full rewrite
      term.clear();
      term.reset();
      term.write(buf);
      lastLenRef.current = buf.length;
    }
  }, [state.buffer]);

  // pointer-events: none while disabled, so focus/typing can't reach the xterm canvas
  return <div ref={hostRef} className={`${puTerminal}${state.$enabled === false ? ` ${puTerminalDisabled}` : ""}`} />;
}
