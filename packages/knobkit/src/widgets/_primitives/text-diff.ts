/**
 * The one span of `from` that has to be replaced to turn it into `to`: what is left after the
 * common start and the common end. `null` when they are equal. Replacing only this keeps a cursor
 * that sits outside it where it was, which replacing the whole text does not.
 */
export function changedSpan(from: string, to: string): { from: number; to: number; insert: string } | null {
  if (from === to) return null;
  const max = Math.min(from.length, to.length);
  let start = 0;
  while (start < max && from.charCodeAt(start) === to.charCodeAt(start)) start++;
  let end = 0;
  while (end < max - start && from.charCodeAt(from.length - 1 - end) === to.charCodeAt(to.length - 1 - end)) end++;
  return { from: start, to: from.length - end, insert: to.slice(start, to.length - end) };
}
