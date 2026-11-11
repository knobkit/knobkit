/**
 * Text that does not fit its box is cut with an ellipsis; give the box its whole text as hover text
 * while it is cut, and none while it fits. Call when the pointer comes over the element.
 */
export function titleWhenCut(el: HTMLElement, text: string = el.textContent ?? ""): void {
  if (el.scrollWidth > el.clientWidth && text) el.title = text;
  else if (el.title) el.removeAttribute("title");
}
