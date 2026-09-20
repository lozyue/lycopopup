import type { LycoStyleVars } from "../lyco-shortcuts-types";
import { sanitizeStyleVarName } from "../utils/pure";

export function applyStyleVars(
  element: HTMLElement,
  vars?: LycoStyleVars
): void {
  if (!vars) return;

  for (const [key, value] of Object.entries(vars)) {
    if (!sanitizeStyleVarName(key)) continue;

    if (value === null || value === undefined) {
      element.style.removeProperty(key);
    } else {
      element.style.setProperty(key, String(value));
    }
  }
}
