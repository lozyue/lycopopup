const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  "textarea:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getFocusable(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      if (element.hidden) return false;
      if (element.getAttribute("aria-hidden") === "true") return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    }
  );
}

export function trapTabKey(event: KeyboardEvent, root: ParentNode): boolean {
  if (event.key !== "Tab") return false;

  const focusables = getFocusable(root);
  if (focusables.length === 0) {
    event.preventDefault();
    return true;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }

  return false;
}

export function focusInitial(
  root: ParentNode,
  fallback: HTMLElement,
  selector?: string | boolean
): boolean {
  if (typeof selector === "string") {
    const target = root.querySelector<HTMLElement>(selector);
    if (target) {
      target.focus();
      return true;
    }
  }

  const autofocus = root.querySelector<HTMLElement>("[autofocus]");
  if (autofocus) {
    autofocus.focus();
    return true;
  }

  const first = getFocusable(root)[0];
  if (first && selector !== false) {
    first.focus();
    return true;
  }

  fallback.focus();
  return true;
}
