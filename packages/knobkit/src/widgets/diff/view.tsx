import { puDiff, puDiffCode, puDiffContent, puDiffEmpty, puDiffFile, puDiffFileIcon, puDiffFilePath, puDiffLn, puDiffMain, puDiffModeBtn, puDiffModeGroup, puDiffSidebar, puDiffSidebarTitle, puDiffSign, puDiffSplit, puDiffSplitHeader, puDiffSplitPane, puDiffTable, puDiffToolbar, puDiffToolbarPath } from "./diff.css.js";
import { useMemo, useState } from "react";
import type { ViewProps } from "@knobkit/core/client";
import type { FileDiff } from "./def.js";

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
  files: FileDiff[];
  activeFile: number;
  onSelect: (i: number) => void;
}) {
  const statusIcon: Record<string, string> = { added: "added", modified: "modified", deleted: "deleted", renamed: "renamed" };
  return (
    <div className={puDiffSidebar}>
      <div className={puDiffSidebarTitle}>Files ({files.length})</div>
      {files.map((f, i) => (
        <button
          key={i}
          className={puDiffFile}
          aria-selected={i === activeFile}
          onClick={() => onSelect(i)}
        >
          <span className={`${puDiffFileIcon} pu-diff-file-icon--${statusIcon[f.status ?? "modified"] ?? "modified"}`} />
          <span className={puDiffFilePath}>{f.path}</span>
        </button>
      ))}
    </div>
  );
}

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <div className={puDiffContent}>
      <table className={puDiffTable}>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className={line.type !== "same" ? `pu-diff-row--${line.type}` : undefined}>
              <td className={puDiffLn}>{line.oldNum ?? ""}</td>
              <td className={puDiffLn}>{line.newNum ?? ""}</td>
              <td className={puDiffSign}>
                {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
              </td>
              <td className={puDiffCode}>{line.content}</td>
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
    <div className={puDiffSplitPane}>
      <div className={puDiffSplitHeader}>{header}</div>
      <table className={puDiffTable}>
        <tbody>
          {rows.map((line, i) => (
            <tr
              key={i}
              className={
                line && line.type !== "same" ? `pu-diff-row--${line.type}` : undefined
              }
            >
              <td className={puDiffLn}>{line?.oldNum ?? line?.newNum ?? ""}</td>
              <td className={puDiffSign}>
                {line
                  ? line.type === "add"
                    ? "+"
                    : line.type === "remove"
                      ? "−"
                      : " "
                  : ""}
              </td>
              <td className={puDiffCode}>{line?.content ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={puDiffSplit}>
      {renderPane(left, "Old")}
      {renderPane(right, "New")}
    </div>
  );
}

// ── main view ───────────────────────────────────────────────────────────────

export default function DiffView({ state }: ViewProps<{ files: FileDiff[] }>) {
  const files = state.files ?? [];
  // presentation-only concerns, so plain component state (widget state is just `files`)
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const [activeFile, setActiveFile] = useState(0);
  const active = Math.min(activeFile, Math.max(0, files.length - 1)); // clamp after setFiles shrinks the list
  const file = files[active] as FileDiff | undefined;

  const lines = useMemo<DiffLine[]>(() => {
    if (!file) return [];
    return computeDiff(splitLines(file.oldContent), splitLines(file.newContent));
  }, [file]);

  if (files.length === 0) {
    return (
      <div className={puDiff}>
        <div className={puDiffEmpty}>No files to review</div>
      </div>
    );
  }

  return (
    <div className={puDiff}>
      {files.length > 1 && (
        <FileList files={files} activeFile={active} onSelect={setActiveFile} />
      )}
      <div className={puDiffMain}>
        <div className={puDiffToolbar}>
          <span className={puDiffToolbarPath}>{file?.path ?? ""}</span>
          <div className={puDiffModeGroup}>
            <button
              className={puDiffModeBtn}
              aria-pressed={mode === "unified"}
              onClick={() => setMode("unified")}
            >
              Unified
            </button>
            <button
              className={puDiffModeBtn}
              aria-pressed={mode === "split"}
              onClick={() => setMode("split")}
            >
              Split
            </button>
          </div>
        </div>
        {mode === "unified" ? <UnifiedView lines={lines} /> : <SplitView lines={lines} />}
      </div>
    </div>
  );
}
