import type { LycoAttrs } from "../lyco-shortcuts-types";

export function applyAttrs(element: HTMLElement, attrs?: LycoAttrs): void {
  if (!attrs) return;

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) {
      element.removeAttribute(key);
    } else if (value === true) {
      element.setAttribute(key, "");
    } else {
      element.setAttribute(key, String(value));
    }
  }
}

export function setBoolAttr(
  element: Element,
  attr: string,
  value: boolean | undefined
): void {
  if (value) element.setAttribute(attr, "");
  else element.removeAttribute(attr);
}
