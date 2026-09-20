import type {
  LycoCloseReason,
  LycoLayerOrder,
  LycoPlacement,
  LycoPopupAction,
  LycoPopupState,
} from "../lyco-shortcuts-types";

export const DEFAULT_LAYER_PLACEMENT: LycoPlacement = "top-end";
export const DEFAULT_LAYER_ORDER: LycoLayerOrder = "oldest-first";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasOwn<T extends object, K extends PropertyKey>(
  target: T,
  key: K
): key is K & keyof T {
  return Object.prototype.hasOwnProperty.call(target, key);
}

export function clampNumber(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function finiteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeDuration(value: unknown, fallback: number): number {
  return Math.max(0, finiteNumber(value, fallback));
}

export function normalizePositiveInteger(
  value: unknown,
  fallback: number
): number {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)));
}

export function mergeDefined<T extends object>(
  ...sources: Array<Partial<T> | undefined | null>
): T {
  const output: Record<string, unknown> = {};

  for (const source of sources) {
    if (!source) continue;
    for (const key of Object.keys(source) as Array<keyof T>) {
      const value = source[key];
      if (value !== undefined) output[String(key)] = value;
    }
  }

  return output as T;
}

export function copyDefined<T extends object>(
  source: Partial<T> | undefined | null
): Partial<T> {
  if (!source) return {};

  const output: Partial<T> = {};
  for (const key of Object.keys(source) as Array<keyof T>) {
    const value = source[key];
    if (value !== undefined) {
      (output as Record<string, unknown>)[String(key)] = value;
    }
  }

  return output;
}

export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function splitPlacement(placement: LycoPlacement): {
  side: "top" | "right" | "bottom" | "left" | "center";
  align: "start" | "center" | "end";
} {
  if (placement === "center") return { side: "center", align: "center" };

  const [side, align = "center"] = placement.split("-") as [
    "top" | "right" | "bottom" | "left",
    "start" | "end" | undefined,
  ];

  return {
    side,
    align: align ?? "center",
  };
}

export function isEdgePlacement(placement: LycoPlacement): boolean {
  return splitPlacement(placement).side !== "center";
}

export function getSlideOffset(placement: LycoPlacement): string {
  const { side } = splitPlacement(placement);

  switch (side) {
    case "top":
      return "0 -16px";
    case "right":
      return "16px 0";
    case "bottom":
      return "0 16px";
    case "left":
      return "-16px 0";
    default:
      return "0 8px";
  }
}

export function getRoleCloseReason(
  role: LycoPopupAction["role"]
): LycoCloseReason {
  if (role === "cancel") return "cancel";
  if (role === "confirm" || role === "danger") return "confirm";
  return "action";
}

export function sortActions<T extends LycoPopupAction>(
  actions: readonly T[] | undefined
): T[] {
  if (!actions || actions.length === 0) return [];

  return [...actions].sort((a, b) => {
    const orderA = finiteNumber(a.order, 0);
    const orderB = finiteNumber(b.order, 0);
    return orderA - orderB;
  });
}

export function isTerminalState(state: LycoPopupState): boolean {
  return state === "closed" || state === "destroyed";
}

export function toCssLength(value: string | number | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "number") return `${value}px`;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function comparePriority(
  a: { priority?: number },
  b: { priority?: number }
): number {
  return finiteNumber(a.priority, 0) - finiteNumber(b.priority, 0);
}

export function sanitizeStyleVarName(name: string): name is `--${string}` {
  return /^--[a-zA-Z0-9_-]+$/.test(name);
}
