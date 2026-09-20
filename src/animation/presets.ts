import type {
  LycoAnimationOptions,
  LycoAnimationPreset,
  LycoPlacement,
} from "../lyco-shortcuts-types";
import { getSlideOffset } from "../utils/pure";

export const DEFAULT_ANIMATION_DURATION = 180;
export const DEFAULT_EXIT_DURATION = 140;
export const DEFAULT_ANIMATION_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

export function resolveAnimationPreset(
  preset: LycoAnimationPreset | undefined,
  placement: LycoPlacement,
  phase: "enter" | "exit"
): Keyframe[] {
  const offset = getSlideOffset(placement);
  const reverseOffset = offset
    .split(" ")
    .map((value) => {
      if (value === "0") return value;
      if (value.startsWith("-")) return value.slice(1);
      return `-${value}`;
    })
    .join(" ");

  const fromOffset = phase === "enter" ? offset : "0 0";
  const toOffset = phase === "enter" ? "0 0" : reverseOffset;
  const fromOpacity = phase === "enter" ? 0 : 1;
  const toOpacity = phase === "enter" ? 1 : 0;

  switch (preset ?? "slide-fade") {
    case "none":
      return [];
    case "fade":
      return [{ opacity: fromOpacity }, { opacity: toOpacity }];
    case "scale":
      return [
        { opacity: fromOpacity, transform: phase === "enter" ? "scale(.96)" : "scale(1)" },
        { opacity: toOpacity, transform: phase === "enter" ? "scale(1)" : "scale(.98)" },
      ];
    case "slide":
      return [
        { transform: `translate(${fromOffset})` },
        { transform: `translate(${toOffset})` },
      ];
    case "toast":
      return [
        {
          opacity: fromOpacity,
          transform:
            phase === "enter"
              ? `translate(${offset}) scale(.98)`
              : "translate(0, 0) scale(1)",
        },
        {
          opacity: toOpacity,
          transform:
            phase === "enter"
              ? "translate(0, 0) scale(1)"
              : `translate(${reverseOffset}) scale(.98)`,
        },
      ];
    case "slide-fade":
    default:
      return [
        { opacity: fromOpacity, transform: `translate(${fromOffset})` },
        { opacity: toOpacity, transform: `translate(${toOffset})` },
      ];
  }
}

export function resolveKeyframes(
  options: LycoAnimationOptions | undefined,
  placement: LycoPlacement,
  phase: "enter" | "exit"
): Keyframe[] {
  const custom = phase === "enter" ? options?.enter : options?.exit;
  if (custom && custom.length > 0) return custom;
  return resolveAnimationPreset(options?.preset, placement, phase);
}
