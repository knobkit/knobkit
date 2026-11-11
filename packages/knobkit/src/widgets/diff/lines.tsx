import { puDiffCode, puDiffContent, puDiffLn, puDiffSign, puDiffTable } from "./diff.css.js";

// Shared by the diff widget and the chat's approval card, which shows a tool call's change the
// same way.

// ── simple LCS-based line diff ──────────────────────────────────────────────

export interface DiffLine {
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
export function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
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

export function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split("\n");
}

// ── unified view ────────────────────────────────────────────────────────────

export function UnifiedView({ lines }: { lines: DiffLine[] }) {
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
