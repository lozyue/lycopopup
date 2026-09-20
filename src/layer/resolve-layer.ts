import type { LycoLayerInput, LycoPopupLayerOptions } from "../lyco-shortcuts-types";
import {
  createLycoPopupLayer,
  isLayerController,
  toInternalLayerController,
  type LycoLayerControllerInternal,
} from "./layer-controller";
import { mergeDefined } from "../utils/pure";

export function resolveLayer(
  input: LycoLayerInput | undefined,
  fallback: LycoPopupLayerOptions
): LycoLayerControllerInternal {
  if (isLayerController(input)) return toInternalLayerController(input);

  return toInternalLayerController(
    createLycoPopupLayer(mergeDefined<LycoPopupLayerOptions>(fallback, input))
  );
}
