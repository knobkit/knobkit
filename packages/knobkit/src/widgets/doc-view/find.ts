// Finding a passage in a rendered document by its text. A sentence on the page is rarely one
// piece: formatting splits it into several elements, a PDF line is its own element, and a typeset
// line may end in the middle of a word.

const INLINE = new Set(["SPAN", "A", "B", "I", "EM", "STRONG", "U", "S", "SUB", "SUP", "SMALL", "MARK", "INS", "DEL", "FONT", "CODE"]);
const SKIP = new Set(["STYLE", "SCRIPT", "TEMPLATE", "CANVAS", "SVG"]);
const HYPHENS = /[-­‐‑]/;

interface Flat {
  /** the text of the container, one character per entry of `at` */
  text: string;
  /** where each character is: its text node and offset, or null for a break between blocks or lines */
  at: ({ node: Text; offset: number } | null)[];
}

function flatten(root: Element): Flat {
  let text = "";
  const at: Flat["at"] = [];
  const gap = (): void => {
    if (text && !text.endsWith("\n")) {
      text += "\n";
      at.push(null);
    }
  };
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = (node as Text).data;
      for (let i = 0; i < data.length; i++) at.push({ node: node as Text, offset: i });
      text += data;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (node as Element).tagName.toUpperCase();
    if (SKIP.has(tag)) return;
    // text in separate blocks, and on separate lines of a PDF, is separate words
    const apart = !INLINE.has(tag);
    if (apart) gap();
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
    if (apart) gap();
  };
  walk(root);
  return { text, at };
}

/** `flat` with some characters left out, remembering where each kept one came from. */
function reduce(text: string, keep: (ch: string, i: number) => string | null): { text: string; from: number[] } {
  let out = "";
  const from: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = keep(text[i]!, i);
    if (ch === null) continue;
    out += ch;
    from.push(i);
  }
  return { text: out, from };
}

/**
 * The passage as a range in the document, or null when it is not there. Tried as written first
 * (runs of white space count as one space), then with spaces and hyphens ignored on both sides,
 * which is what finds a sentence whose word is broken over a line: "interpre-" / "tations".
 */
export function findText(root: Element, passage: string): Range | null {
  const want = passage.replace(/\s+/g, " ").trim();
  if (!want) return null;
  const flat = flatten(root);

  let prevSpace = true;
  const spaced = reduce(flat.text, (ch) => {
    const space = /\s/.test(ch);
    if (space && prevSpace) return null;
    prevSpace = space;
    return space ? " " : ch;
  });
  let hit = spaced.text.indexOf(want);
  let span: [number, number] | null = hit < 0 ? null : [spaced.from[hit]!, spaced.from[hit + want.length - 1]!];

  if (!span) {
    const squeeze = (s: string): { text: string; from: number[] } => reduce(s, (ch) => (/\s/.test(ch) || HYPHENS.test(ch) ? null : ch));
    const tight = squeeze(flat.text);
    const wantTight = squeeze(want).text;
    hit = wantTight ? tight.text.indexOf(wantTight) : -1;
    if (hit >= 0) span = [tight.from[hit]!, tight.from[hit + wantTight.length - 1]!];
  }
  if (!span) return null;

  const start = flat.at[span[0]];
  const end = flat.at[span[1]];
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset + 1);
  return range;
}
