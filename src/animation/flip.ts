import type { LycoAnimationOptions } from "../lyco-shortcuts-types";
import { DEFAULT_ANIMATION_DURATION, DEFAULT_ANIMATION_EASING } from "./presets";
import { prefersReducedMotion } from "./reduced-motion";

export type FlipSnapshot = Map<HTMLElement, DOMRect>;

export function captureFlip(elements: Iterable<HTMLElement>): FlipSnapshot {
  const snapshot = new Map<HTMLElement, DOMRect>();
  for (const element of elements) {
    snapshot.set(element, element.getBoundingClientRect());
  }
  return snapshot;
}

export function playFlip(
  snapshot: FlipSnapshot,
  options?: LycoAnimationOptions
): void {
  if (options?.preset === "none") return;
  if ((options?.respectReducedMotion ?? true) && prefersReducedMotion()) return;
  if (typeof Element.prototype.animate !== "function") return;

  for (const [element, from] of snapshot) {
    if (!element.isConnected) continue;

    const to = element.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (dx === 0 && dy === 0) continue;

    element.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0, 0)" },
      ],
      {
        duration: options?.duration ?? DEFAULT_ANIMATION_DURATION,
        easing: options?.easing ?? DEFAULT_ANIMATION_EASING,
      }
    );
  }
}
