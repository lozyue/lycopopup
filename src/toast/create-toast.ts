import type {
  LycoActionContext,
  LycoCloseReason,
  LycoErrorContext,
  LycoPopupController,
  LycoRenderContext,
  LycoToastInstance,
  LycoToastInstanceOptions,
  LycoToastOptions,
} from "../lyco-shortcuts-types";
import { animatePopup } from "../animation/animate";
import { createPopupController, type InternalPopupController } from "../core/controller";
import {
  applyElementOptions,
  createElementFromInput,
  resolveModelContent,
  setElementModel,
} from "../core/element";
import { defineLycoToastElement, type LycoToastRenderModel } from "./lyco-toast";
import { resolveLayer } from "../layer/resolve-layer";
import type { LycoLayerControllerInternal } from "../layer/layer-controller";
import { createLycoId } from "../utils/id";
import { createPausableTimer, type PausableTimer } from "../utils/timer";
import { getRoleCloseReason, isRecord, mergeDefined, normalizeDuration } from "../utils/pure";

interface ToastRecord<TResult> {
  options: LycoToastOptions<TResult>;
  element: HTMLElement;
  controller: InternalPopupController<TResult>;
  abort: AbortController;
  timer: PausableTimer | null;
  ctx: LycoRenderContext<TResult>;
}

const DEFAULT_TOAST_OPTIONS: Partial<LycoToastOptions> = {
  duration: 1800,
  tone: "neutral",
  replace: true,
  pauseOnHover: true,
  closable: false,
};

function toToastOptions<TResult>(
  messageOrOptions: string | number | LycoToastOptions<TResult>
): LycoToastOptions<TResult> {
  if (typeof messageOrOptions === "object" && messageOrOptions !== null) {
    return messageOrOptions as LycoToastOptions<TResult>;
  }
  return { message: messageOrOptions };
}

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

function buildToastModel<TResult>(
  record: ToastRecord<TResult>,
  onError?: (ctx: LycoErrorContext<TResult>) => void
): LycoToastRenderModel<TResult> {
  const { options, ctx } = record;
  const reportRenderError = (error: unknown) =>
    emitError(onError, { phase: "render", error, controller: record.controller });

  return {
    message: resolveModelContent(options.message, ctx, reportRenderError),
    content: resolveModelContent(options.content, ctx, reportRenderError),
    tone: options.tone,
    action: options.action,
    closable: options.closable,
  };
}

export function createLycoToast<TResult = unknown>(
  instanceOptions: LycoToastInstanceOptions<TResult> = {}
): LycoToastInstance<TResult> {
  if (instanceOptions.autoDefine !== false) defineLycoToastElement();

  const layer = resolveLayer(instanceOptions.layer, {
    placement: "bottom",
    zIndex: 5200,
    order: "oldest-first",
  });
  const onError = instanceOptions.onError;

  let current: ToastRecord<TResult> | null = null;
  let createFn:
    | ((messageOrOptions: string | number | LycoToastOptions<TResult>) => LycoPopupController<TResult>)
    | null = null;

  const closeRecord = async (
    record: ToastRecord<TResult>,
    reason: LycoCloseReason,
    value?: TResult
  ) => {
    if (record.controller.state === "closing" || record.controller.state === "destroyed") {
      return;
    }

    if (record.options.onBeforeClose) {
      try {
        const accepted = await record.options.onBeforeClose({
          reason,
          value,
          controller: record.controller,
        });
        if (accepted === false) return;
      } catch (error) {
        emitError(onError, {
          phase: "before-close",
          error,
          controller: record.controller,
        });
        return;
      }
    }

    record.timer?.clear();
    record.controller.setState("closing");
    await animatePopup(
      record.element,
      layer.options.placement,
      "exit",
      record.options.animation ?? instanceOptions.animation,
      (ctx) => emitError(onError, { ...ctx, controller: record.controller })
    );
    layer.unmountItem(record.controller);
    record.controller.settle(reason, value);
    record.controller.setState("destroyed");
    record.abort.abort();
    if (current === record) current = null;
  };

  const updateRecord = (record: ToastRecord<TResult>, patch: unknown) => {
    if (!isRecord(patch)) return;

    record.options = mergeDefined<LycoToastOptions<TResult>>(
      record.options,
      patch as Partial<LycoToastOptions<TResult>>
    );
    setElementModel(record.element, buildToastModel(record, onError));

    if ("duration" in patch) {
      const duration = normalizeDuration(record.options.duration, 1800);
      if (duration > 0) {
        if (record.timer) record.timer.restart(duration);
        else {
          record.timer = createPausableTimer(
            () => void record.controller.close("timeout"),
            duration
          );
        }
      } else {
        record.timer?.clear();
        record.timer = null;
      }
    }
  };

  const handleAction = async (record: ToastRecord<TResult>, event: CustomEvent) => {
    const action = record.options.action;
    if (!action || action.disabled || action.loading) return;

    const ctx: LycoActionContext<TResult> = {
      controller: record.controller,
      close: (reason = getRoleCloseReason(action.role), value = action.value) =>
        record.controller.close(reason, value),
      update: (patch) => record.controller.update(patch),
      event: event.detail?.event ?? event,
      signal: record.abort.signal,
    };

    try {
      const result = action.onClick?.(ctx);
      const accepted = result instanceof Promise ? await result : result;
      if (accepted !== false && action.close) {
        await record.controller.close(getRoleCloseReason(action.role), action.value);
      }
    } catch (error) {
      emitError(onError, { phase: "action", error, controller: record.controller });
    }
  };

  const createRecord = (rawOptions: LycoToastOptions<TResult>): ToastRecord<TResult> => {
    const options = mergeDefined<LycoToastOptions<TResult>>(
      DEFAULT_TOAST_OPTIONS as Partial<LycoToastOptions<TResult>>,
      instanceOptions.defaults,
      rawOptions
    );
    const element = createElementFromInput(options.element, "lyco-toast");
    const abort = new AbortController();
    const id = options.id ?? createLycoId("lyco-toast");

    const controller = createPopupController<TResult>({
      id,
      key: options.key,
      type: "toast",
      element,
    });

    const ctx: LycoRenderContext<TResult> = {
      id,
      key: options.key,
      close: (value, reason = "programmatic") => controller.close(reason, value),
      update: (patch) => controller.update(patch),
      signal: abort.signal,
    };

    const record: ToastRecord<TResult> = {
      options,
      element,
      controller,
      abort,
      timer: null,
      ctx,
    };

    controller.setCloseHandler((reason, value) => closeRecord(record, reason, value));
    controller.setUpdateHandler((patch) => updateRecord(record, patch));
    controller.setFocusHandler((focusOptions) => {
      element.focus(focusOptions);
      return document.activeElement === element;
    });

    applyElementOptions(element, options);
    setElementModel(element, buildToastModel(record, onError));

    element.addEventListener(
      "lyco-close",
      () => void controller.close("programmatic"),
      { signal: abort.signal }
    );
    element.addEventListener(
      "lyco-action",
      (event) => void handleAction(record, event as CustomEvent),
      { signal: abort.signal }
    );

    if (options.pauseOnHover) {
      element.addEventListener("mouseenter", () => record.timer?.pause(), {
        signal: abort.signal,
      });
      element.addEventListener("mouseleave", () => record.timer?.resume(), {
        signal: abort.signal,
      });
      element.addEventListener("focusin", () => record.timer?.pause(), {
        signal: abort.signal,
      });
      element.addEventListener("focusout", () => record.timer?.resume(), {
        signal: abort.signal,
      });
    }

    void controller.finished.then((result) => record.options.onClose?.(result));
    return record;
  };

  const mountRecord = async (record: ToastRecord<TResult>) => {
    record.controller.setState("mounting");
    layer.mountItem(record.controller, layer.options.order);
    record.controller.setState("opening");
    await animatePopup(
      record.element,
      layer.options.placement,
      "enter",
      record.options.animation ?? instanceOptions.animation,
      (ctx) => emitError(onError, { ...ctx, controller: record.controller })
    );
    if (record.controller.state !== "opening") return;

    record.controller.setState("open");
    record.options.onOpen?.(record.controller);

    const duration = normalizeDuration(record.options.duration, 1800);
    if (duration > 0) {
      record.timer = createPausableTimer(
        () => void record.controller.close("timeout"),
        duration
      );
    }
  };

  const open = (
    messageOrOptions: string | number | LycoToastOptions<TResult>
  ): LycoPopupController<TResult> => {
    const rawOptions = toToastOptions(messageOrOptions);
    if (rawOptions.replace !== false && current) {
      void current.controller.close("replaced");
    }

    const record = createRecord(rawOptions);
    current = record;
    void mountRecord(record);
    return record.controller;
  };

  const instance: LycoToastInstance<TResult> = {
    open,

    getCreateFn() {
      if (!createFn) createFn = open;
      return createFn;
    },

    closeAll(reason = "programmatic") {
      return layer.closeAll(reason);
    },

    hideAll() {
      layer.hideAll();
    },

    showAll() {
      layer.showAll();
    },

    destroy() {
      current = null;
      layer.destroy();
    },
  };

  return instance;
}
