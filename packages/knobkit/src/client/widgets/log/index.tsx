import "./log.css";
import { useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import type { ViewProps } from "../../view.js";

type LogState = { lines: string[]; filter: string };

// ---------------------------------------------------------------------------
// ANSI parsing: bold, red, green, yellow, blue, reset
// ---------------------------------------------------------------------------

interface AnsiSpan {
  text: string;
  bold: boolean;
  color: string | null;
}

const ANSI_RE = /\x1b\[(\d+)m/g;

const COLOR_MAP: Record<string, string> = {
  "31": "pu-ansi-red",
  "32": "pu-ansi-green",
  "33": "pu-ansi-yellow",
  "34": "pu-ansi-blue",
};

function parseAnsi(raw: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  let last = 0;
  let bold = false;
  let color: string | null = null;

  for (const m of raw.matchAll(ANSI_RE)) {
    const idx = m.index!;
    if (idx > last) {
      spans.push({ text: raw.slice(last, idx), bold, color });
    }
    const code = m[1];
    if (code === "0") {
      bold = false;
      color = null;
    } else if (code === "1") {
      bold = true;
    } else if (COLOR_MAP[code]) {
      color = COLOR_MAP[code];
    }
    last = idx + m[0].length;
  }
  if (last < raw.length) {
    spans.push({ text: raw.slice(last), bold, color });
  }
  return spans;
}

function renderAnsi(raw: string): ReactNode {
  const spans = parseAnsi(raw);
  if (spans.length === 1 && !spans[0].bold && !spans[0].color) {
    return spans[0].text;
  }
  return spans.map((s, i) => {
    const cls = [s.bold ? "pu-ansi-bold" : "", s.color ?? ""]
      .filter(Boolean)
      .join(" ");
    return cls ? (
      <span key={i} className={cls}>
        {s.text}
      </span>
    ) : (
      s.text
    );
  });
}

// ---------------------------------------------------------------------------
// Level detection
// ---------------------------------------------------------------------------

type Level = "info" | "warn" | "error" | "debug";

const LEVEL_RE = /^\[(INFO|WARN|ERROR|DEBUG)\]/i;

function detectLevel(line: string): Level {
  const m = line.match(LEVEL_RE);
  if (!m) return "info";
  return m[1].toLowerCase() as Level;
}

// ---------------------------------------------------------------------------
// LogView
// ---------------------------------------------------------------------------

export function LogView({ state }: ViewProps<any, LogState>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = state.lines ?? [];
  const filter = state.filter ?? "";

  const filtered = useMemo(() => {
    if (!filter) return lines;
    const lower = filter.toLowerCase();
    return lines.filter((l) => l.toLowerCase().includes(lower));
  }, [lines, filter]);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [filtered.length]);

  return (
    <div className="pu-log">
      <div className="pu-log-lines" ref={scrollRef}>
        {filtered.map((line, i) => {
          const level = detectLevel(line);
          return (
            <div key={i} className={`pu-log-line pu-log-line--${level}`}>
              {renderAnsi(line)}
            </div>
          );
        })}
      </div>
      <div className="pu-log-footer">
        {filtered.length}
        {filter ? ` / ${lines.length}` : ""} line{lines.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
