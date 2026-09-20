import type {
  LycoElementControllerOptions,
  LycoElementControllerResult,
  LycoErrorContext,
  LycoPopupController,
  LycoRenderContext,
} from "../lyco-shortcuts-types";
import { animatePopup } from "../animation/animate";
import { createPopupController } from "./controller";
import {
  applyElementOptions,
  createElementFromInput,
  resolveModelContent,
  setElementModel,
} from "./element";
import { resolveLayer } from "../layer/resolve-layer";
import { defineLycoPopupElements } from "../define";
import { createLycoId } from "../utils/id";
import { isRecord, mergeDefined } from "../utils/pure";

function emitError<TResult>(
  onError: ((ctx: LycoErrorContext<TResult>) => void) | undefined,
  ctx: LycoErrorContext<TResult>
): void {
  try {
    onError?.(ctx);
  } catch {
    // Error hooks are isolated from popup lifecycle.
  }
}

export function createLycoPopupElement<TResult = unknown>(
  options: LycoElementControllerOptions<TResult>
): LycoElementControllerResult<TResult> {
  defineLycoPopupElements();

  const layer = resolveLayer(options.layer, {
    placement: "center",
    zIndex: 5000,
    order: "oldest-first",
  });
  const element = createElementFromInput(options.element ?? options.tag, "lyco-toast");
  const abort = new AbortController();
  const id = createLycoId(options.type ?? "lyco-custom");

  const controller = createPopupController<TResult>({
    id,
    key: options.key,
    type: options.type ?? "custom",
    element,
  });

  const ctx: LycoRenderContext<TResult> = {
    id,
    key: options.key,
    close: (value, reason = "programmatic") => controller.close(reason, value),
    update: (patch) => controller.update(patch),
    signal: abort.signal,
  };

  const buildModel = () => {
    const content = resolveModelContent(options.content, ctx, (error) =>
      emitError(options.onError, { phase: "render", error, controller })
    );
    return mergeDefined<Record<string, unknown>>(options.props, { content });
  };

  controller.setUpdateHandler((patch) => {
    if (!isRecord(patch)) return;
    options.props = mergeDefined<Record<string, unknown>>(
      options.props ?? {},
      patch
    );
    setElementModel(element, buildModel());
  });
  controller.setCloseHandler(async (reason, value) => {
    controller.setState("closing");
    await animatePopup(
      element,
      layer.options.placement,
      "exit",
      options.animation,
      (ctx) => emitError(options.onError, { ...ctx, controller })
    );
    layer.unmountItem(controller);
    controller.settle(reason, value);
    controller.setState("destroyed");
    abort.abort();
  });

  applyElementOptions(element, options);
  setElementModel(element, buildModel());

  controller.setState("mounting");
  layer.mountItem(controller);
  controller.setState("opening");
  void animatePopup(
    element,
    layer.options.placement,
    "enter",
    options.animation,
    (ctx) => emitError(options.onError, { ...ctx, controller })
  ).then(() => {
    if (controller.state === "opening") controller.setState("open");
  });

  return {
    element,
    controller: controller as LycoPopupController<TResult>,
  };
}
