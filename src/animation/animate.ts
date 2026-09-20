import type {
  LycoAnimationOptions,
  LycoErrorContext,
  LycoPlacement,
} from "../lyco-shortcuts-types";
import { prefersReducedMotion } from "./reduced-motion";
import {
  DEFAULT_ANIMATION_DURATION,
  DEFAULT_ANIMATION_EASING,
  DEFAULT_EXIT_DURATION,
  resolveKeyframes,
} from "./presets";

export async function animatePopup(
  element: HTMLElement,
  placement: LycoPlacement,
  phase: "enter" | "exit",
  options?: LycoAnimationOptions,
  onError?: (ctx: LycoErrorContext) => void
): Promise<void> {
  const respectReducedMotion = options?.respectReducedMotion ?? true;
  if (respectReducedMotion && prefersReducedMotion()) return;

  const keyframes = resolveKeyframes(options, placement, phase);
  if (keyframes.length === 0) return;

  const duration =
    phase === "exit"
      ? options?.exitDuration ?? options?.duration ?? DEFAULT_EXIT_DURATION
      : options?.duration ?? DEFAULT_ANIMATION_DURATION;

  if (duration <= 0 || typeof element.animate !== "function") return;

  try {
    const animation = element.animate(keyframes, {
      duration,
      easing: options?.easing ?? DEFAULT_ANIMATION_EASING,
      fill: "both",
    });

    await animation.finished;
    animation.cancel();
  } catch (error) {
    onError?.({ phase: "animation", error });
  }
}
