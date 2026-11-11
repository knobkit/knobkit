import { puDiff, puDiffCode, puDiffEmpty, puDiffFile, puDiffFileIcon, puDiffFilePath, puDiffLn, puDiffMain, puDiffModeBtn, puDiffModeGroup, puDiffSidebar, puDiffSidebarTitle, puDiffSign, puDiffSplit, puDiffSplitHeader, puDiffSplitPane, puDiffTable, puDiffToolbar, puDiffToolbarPath } from "./diff.css.js";
import { useMemo, useState } from "react";
import type { ViewProps } from "@knobkit/core/client";
import type { FileDiff } from "./def.js";
import { computeDiff, splitLines, UnifiedView } from "./lines.js";
import type { DiffLine } from "./lines.js";

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
