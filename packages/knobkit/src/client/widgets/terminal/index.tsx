// terminal.css is imported by ./lazy.tsx (the static entry wrapper) so it lands in client.css.
import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { ViewProps } from "../../view.js";
import type { TerminalWidget, TerminalState } from "../../../lib/widgets/terminal.js";

// Map knobkit design tokens to an xterm.js ITheme.
// Uses CSS custom property values resolved at mount time.
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

export function TerminalView({ widget, state, enabled, emit }: ViewProps<TerminalWidget, TerminalState>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  // Track how much of `state.buffer` we've already written into the terminal so that on each
  // state update we only write the *new* bytes, avoiding duplication.
  const lastLenRef = useRef(0);
  // Keep enabled in a ref so the onData callback (bound once) always sees the current value.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // --- mount / unmount ---
  useEffect(() => {
    const container = hostRef.current!;

    const term = new Terminal({
      rows: (widget.rows as number) ?? 24,
      cols: (widget.cols as number) ?? 80,
      scrollback: (widget.scrollback as number) ?? 1000,
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
    fitRef.current = fit;

    // Write any initial buffer content that arrived before mount.
    if (state.buffer.length > 0) {
      term.write(state.buffer);
      lastLenRef.current = state.buffer.length;
    }

    // User input → widget.data event
    const dataSub = term.onData((data) => {
      if (enabledRef.current) emit(widget.data(data));
    });

    // Resize → widget.resized event
    const resizeSub = term.onResize(({ cols, rows }) => {
      emit(widget.resized({ cols, rows }));
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
      fitRef.current = null;
      lastLenRef.current = 0;
    };
    // mount once; buffer sync happens in the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- sync state.buffer → terminal ---
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const buf = state.buffer;
    if (buf.length === 0 && lastLenRef.current > 0) {
      // Buffer was cleared (clear() / reset()) — wipe the terminal screen
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

  const classes = `pu-terminal${enabled ? "" : " pu-terminal-disabled"}`;
  return <div ref={hostRef} className={classes} />;
}
