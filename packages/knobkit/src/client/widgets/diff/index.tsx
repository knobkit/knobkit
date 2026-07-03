import "./diff.css";
import { useMemo } from "react";
import type { ViewProps } from "../../view.js";
import type { DiffWidget, DiffFile, DiffState } from "../../../lib/widgets/diff.js";

// ── simple LCS-based line diff ──────────────────────────────────────────────

interface DiffLine {
  type: "add" | "remove" | "same";
  oldNum?: number;
  newNum?: number;
  content: string;
}

/**
 * Compute a line-level diff between two string arrays using an O(n·m) LCS
 * dynamic-programming table, then backtrack to produce a sequence of
 * add/remove/same entries with line numbers for both sides.
 */
function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const n = oldLines.length;
  const m = newLines.length;

  // Build the LCS length table. lcs[i][j] = length of LCS of
  // oldLines[0..i-1] and newLines[0..j-1].
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      lcs[i][j] = oldLines[i - 1] === newLines[j - 1] ? lcs[i - 1][j - 1] + 1 : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }

  // Backtrack through the table to produce the diff.
  const result: DiffLine[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "same", oldNum: i, newNum: j, content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      result.push({ type: "add", newNum: j, content: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: "remove", oldNum: i, content: oldLines[i - 1] });
      i--;
    }
  }

  result.reverse();
  return result;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split("\n");
}

// ── sub-components ──────────────────────────────────────────────────────────

function FileList({
  files,
  activeFile,
  onSelect,
}: {
  files: DiffFile[];
  activeFile: number;
  onSelect: (i: number) => void;
}) {
  const statusIcon: Record<string, string> = { added: "added", modified: "modified", deleted: "deleted", renamed: "renamed" };
  return (
    <div className="pu-diff-sidebar">
      <div className="pu-diff-sidebar-title">Files ({files.length})</div>
      {files.map((f, i) => (
        <button
          key={i}
          className="pu-diff-file"
          aria-selected={i === activeFile}
          onClick={() => onSelect(i)}
        >
          <span className={`pu-diff-file-icon pu-diff-file-icon--${statusIcon[f.status ?? "modified"] ?? "modified"}`} />
          <span className="pu-diff-file-path">{f.path}</span>
        </button>
      ))}
    </div>
  );
}

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="pu-diff-content">
      <table className="pu-diff-table">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className={line.type !== "same" ? `pu-diff-row--${line.type}` : undefined}>
              <td className="pu-diff-ln">{line.oldNum ?? ""}</td>
              <td className="pu-diff-ln">{line.newNum ?? ""}</td>
              <td className="pu-diff-sign">
                {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
              </td>
              <td className="pu-diff-code">{line.content}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SplitView({ lines }: { lines: DiffLine[] }) {
  // Separate into left (old) and right (new) rows, keeping them aligned.
  const left: (DiffLine | null)[] = [];
  const right: (DiffLine | null)[] = [];
  for (const line of lines) {
    if (line.type === "same") {
      left.push(line);
      right.push(line);
    } else if (line.type === "remove") {
      left.push(line);
      right.push(null);
    } else {
      left.push(null);
      right.push(line);
    }
  }

  const renderPane = (rows: (DiffLine | null)[], header: string) => (
    <div className="pu-diff-split-pane">
      <div className="pu-diff-split-header">{header}</div>
      <table className="pu-diff-table">
        <tbody>
          {rows.map((line, i) => (
            <tr
              key={i}
              className={
                line && line.type !== "same" ? `pu-diff-row--${line.type}` : undefined
              }
            >
              <td className="pu-diff-ln">{line?.oldNum ?? line?.newNum ?? ""}</td>
              <td className="pu-diff-sign">
                {line
                  ? line.type === "add"
                    ? "+"
                    : line.type === "remove"
                      ? "−"
                      : " "
                  : ""}
              </td>
              <td className="pu-diff-code">{line?.content ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="pu-diff-split">
      {renderPane(left, "Old")}
      {renderPane(right, "New")}
    </div>
  );
}

// ── main view ───────────────────────────────────────────────────────────────

export function DiffView({ widget, state, emit, set }: ViewProps<DiffWidget, DiffState>) {
  const files = state.files ?? [];
  const mode = state.mode ?? "unified";
  const activeFile = state.activeFile ?? 0;
  const file = files[activeFile] as DiffFile | undefined;

  const lines = useMemo<DiffLine[]>(() => {
    if (!file) return [];
    return computeDiff(splitLines(file.oldContent), splitLines(file.newContent));
  }, [file]);

  const selectFile = (i: number) => {
    set(["activeFile"], i);
    emit(widget.fileSelected({ file: i }));
  };

  const toggleMode = (m: "unified" | "split") => {
    set(["mode"], m);
  };

  if (files.length === 0) {
    return (
      <div className="pu-diff">
        <div className="pu-diff-empty">No files to review</div>
      </div>
    );
  }

  return (
    <div className="pu-diff">
      {files.length > 1 && (
        <FileList files={files} activeFile={activeFile} onSelect={selectFile} />
      )}
      <div className="pu-diff-main">
        <div className="pu-diff-toolbar">
          <span className="pu-diff-toolbar-path">{file?.path ?? ""}</span>
          <div className="pu-diff-mode-group">
            <button
              className="pu-diff-mode-btn"
              aria-pressed={mode === "unified"}
              onClick={() => toggleMode("unified")}
            >
              Unified
            </button>
            <button
              className="pu-diff-mode-btn"
              aria-pressed={mode === "split"}
              onClick={() => toggleMode("split")}
            >
              Split
            </button>
          </div>
          <button
            className="pu-diff-action pu-diff-accept"
            onClick={() => emit(widget.accepted({ file: activeFile }))}
          >
            Accept
          </button>
          <button
            className="pu-diff-action pu-diff-reject"
            onClick={() => emit(widget.rejected({ file: activeFile }))}
          >
            Reject
          </button>
        </div>
        {mode === "unified" ? <UnifiedView lines={lines} /> : <SplitView lines={lines} />}
      </div>
    </div>
  );
}
