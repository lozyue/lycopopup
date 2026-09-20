import type {
  LycoActionContext,
  LycoCloseReason,
  LycoCloseResult,
  LycoDialogAction,
  LycoDialogInstance,
  LycoDialogInstanceOptions,
  LycoDialogOptions,
  LycoErrorContext,
  LycoPlacement,
  LycoPopupController,
  LycoRenderContext,
} from "../lyco-shortcuts-types";
import { animatePopup } from "../animation/animate";
import { createPopupController, type InternalPopupController } from "../core/controller";
import {
  applyElementOptions,
  createElementFromInput,
  resolveModelContent,
  setElementModel,
} from "../core/element";
import { resolveLayer } from "../layer/resolve-layer";
import { defineLycoDialogElement, LycoDialogElement, type LycoDialogRenderModel } from "./lyco-dialog";
import { focusInitial, trapTabKey } from "./focus-trap";
import { lockDocumentScroll } from "./scroll-lock";
import { createLycoId } from "../utils/id";
import { getRoleCloseReason, isRecord, mergeDefined } from "../utils/pure";

interface DialogRecord<TResult> {
  options: LycoDialogOptions<TResult>;
  element: HTMLElement;
  controller: InternalPopupController<TResult>;
  abort: AbortController;
  ctx: LycoRenderContext<TResult>;
  previousFocus: Element | null;
  releaseScroll: (() => void) | null;
  busy: boolean;
  busyFinishers: Array<() => void>;
}

const DEFAULT_DIALOG_OPTIONS: Partial<LycoDialogOptions> = {
  tone: "neutral",
  variant: "dialog",
  role: "dialog",
  scrim: true,
  pointerBlock: true,
  closeOnOutside: true,
  closeOnEscape: true,
  closeWhenBusy: false,
  trapFocus: true,
  restoreFocus: true,
  lockScroll: true,
  showClose: false,
  bodyPadding: true,
  footerPadding: true,
  autofocus: true,
};

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

function shouldIgnoreBusyClose<TResult>(
  record: DialogRecord<TResult>,
  reason: LycoCloseReason
): boolean {
  if (!record.busy || record.options.closeWhenBusy) return false;
  return (
    reason === "outside" ||
    reason === "escape" ||
    reason === "cancel" ||
    reason === "timeout"
  );
}

function buildDialogModel<TResult>(
  record: DialogRecord<TResult>,
  placement: LycoPlacement,
  onError?: (ctx: LycoErrorContext<TResult>) => void
): LycoDialogRenderModel<TResult> {
  const { options, ctx } = record;
  const reportRenderError = (error: unknown) =>
    emitError(onError, { phase: "render", error, controller: record.controller });

  return {
    title: resolveModelContent(options.title, ctx, reportRenderError),
    message: resolveModelContent(options.message, ctx, reportRenderError),
    content: resolveModelContent(options.content, ctx, reportRenderError),
    tone: options.tone,
    variant: options.variant,
    placement: options.placement ?? placement,
    role: options.role,
    actions: options.actions,
    scrim: options.scrim,
    pointerBlock: options.pointerBlock,
    showClose: options.showClose,
    layout: options.layout,
    bodyPadding: options.bodyPadding,
    footerPadding: options.footerPadding,
  };
}

function getDialogPanel(element: HTMLElement): HTMLElement {
  if (element instanceof LycoDialogElement) return element.getPanel();
  return element;
}

export function createLycoDialog<TResult = unknown>(
  instanceOptions: LycoDialogInstanceOptions<TResult> = {}
): LycoDialogInstance<TResult> {
  if (instanceOptions.autoDefine !== false) defineLycoDialogElement();

  const layer = resolveLayer(instanceOptions.layer, {
    placement: "center",
    zIndex: 6000,
    order: "oldest-first",
  });
  const mode = instanceOptions.mode ?? "single";
  const onError = instanceOptions.onError;
  const active: DialogRecord<TResult>[] = [];

  let createFn:
    | ((options: LycoDialogOptions<TResult>) => LycoPopupController<TResult>)
    | null = null;
  let listening = false;

  const removeKeydown = () => {
    if (!listening || active.length > 0) return;
    document.removeEventListener("keydown", onDocumentKeydown, true);
    listening = false;
  };

  const ensureKeydown = () => {
    if (listening) return;
    document.addEventListener("keydown", onDocumentKeydown, true);
    listening = true;
  };

  function onDocumentKeydown(event: KeyboardEvent): void {
    const top = active[active.length - 1];
    if (!top) return;

    if (event.key === "Escape" && top.options.closeOnEscape !== false) {
      event.preventDefault();
      void top.controller.close("escape");
      return;
    }

    if (event.key === "Tab" && top.options.trapFocus !== false) {
      const root = top.element.shadowRoot ?? top.element;
      trapTabKey(event, root);
    }
  }

  const closeRecord = async (
    record: DialogRecord<TResult>,
    reason: LycoCloseReason,
    value?: TResult
  ) => {
    if (record.controller.state === "closing" || record.controller.state === "destroyed") {
      return;
    }
    if (shouldIgnoreBusyClose(record, reason)) return;

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

    record.controller.setState("closing");
    await animatePopup(
      getDialogPanel(record.element),
      record.options.placement ?? layer.options.placement,
      "exit",
      record.options.animation ?? instanceOptions.animation,
      (ctx) => emitError(onError, { ...ctx, controller: record.controller })
    );

    const index = active.indexOf(record);
    if (index >= 0) active.splice(index, 1);
    layer.unmountItem(record.controller);
    record.releaseScroll?.();

    if (
      record.options.restoreFocus !== false &&
      record.previousFocus instanceof HTMLElement &&
      record.previousFocus.isConnected
    ) {
      record.previousFocus.focus({ preventScroll: true });
    }

    record.controller.settle(reason, value);
    record.controller.setState("destroyed");
    record.abort.abort();
    removeKeydown();
  };

  const updateRecord = (
    record: DialogRecord<TResult>,
    rawPatch: Partial<LycoDialogOptions<TResult>>
  ) => {
    record.options = mergeDefined<LycoDialogOptions<TResult>>(record.options, rawPatch);
    setElementModel(
      record.element,
      buildDialogModel(record, layer.options.placement, onError)
    );
  };

  const setBusy = (
    record: DialogRecord<TResult>,
    busy: boolean,
    action?: LycoDialogAction<TResult>
  ) => {
    record.busy = busy;
    if (busy) {
      record.busyFinishers = [];
      record.controller.setState("busy");
      record.options.onBusy?.({
        reason: "action",
        actionId: action?.id,
        onFinish(cb) {
          if (!record.busy) return false;
          record.busyFinishers.push(cb);
          return true;
        },
      });
      return;
    }

    const finishers = record.busyFinishers.splice(0);
    for (const finisher of finishers) {
      try {
        finisher();
      } catch (error) {
        emitError(onError, { phase: "lifecycle", error, controller: record.controller });
      }
    }
    if (record.controller.state === "busy") record.controller.setState("open");
  };

  const handleAction = async (
    record: DialogRecord<TResult>,
    event: CustomEvent
  ) => {
    const action = event.detail?.action as LycoDialogAction<TResult> | undefined;
    if (!action || action.disabled || action.loading) return;
    if (record.busy && !record.options.closeWhenBusy) return;

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
      const isAsync = Boolean(result && typeof (result as Promise<unknown>).then === "function");
      if (isAsync) setBusy(record, true, action);
      const accepted = isAsync ? await result : result;
      if (isAsync) setBusy(record, false, action);

      if (accepted !== false && action.close) {
        await record.controller.close(getRoleCloseReason(action.role), action.value);
      }
    } catch (error) {
      if (record.busy) setBusy(record, false, action);
      emitError(onError, { phase: "action", error, controller: record.controller });
    }
  };

  const createRecord = (
    rawOptions: LycoDialogOptions<TResult>
  ): DialogRecord<TResult> => {
    const options = mergeDefined<LycoDialogOptions<TResult>>(
      DEFAULT_DIALOG_OPTIONS as Partial<LycoDialogOptions<TResult>>,
      instanceOptions.defaults,
      rawOptions
    );
    const element = createElementFromInput(options.element, "lyco-dialog");
    const abort = new AbortController();
    const id = options.id ?? createLycoId("lyco-dialog");

    const controller = createPopupController<TResult>({
      id,
      key: options.key,
      type: "dialog",
      element,
    });

    const ctx: LycoRenderContext<TResult> = {
      id,
      key: options.key,
      close: (value, reason = "programmatic") => controller.close(reason, value),
      update: (patch) => controller.update(patch),
      signal: abort.signal,
    };

    const record: DialogRecord<TResult> = {
      options,
      element,
      controller,
      abort,
      ctx,
      previousFocus: null,
      releaseScroll: null,
      busy: false,
      busyFinishers: [],
    };

    controller.setCloseHandler((reason, value) => closeRecord(record, reason, value));
    controller.setUpdateHandler((patch) => {
      if (isRecord(patch)) updateRecord(record, patch as Partial<LycoDialogOptions<TResult>>);
    });
    controller.setFocusHandler((focusOptions) => {
      const root = element.shadowRoot ?? element;
      return focusInitial(root, getDialogPanel(element), options.autofocus ?? true);
    });

    applyElementOptions(element, options);
    setElementModel(
      element,
      buildDialogModel(record, layer.options.placement, onError)
    );

    element.addEventListener(
      "lyco-close",
      () => void controller.close("cancel"),
      { signal: abort.signal }
    );
    element.addEventListener(
      "lyco-outside",
      () => {
        if (record.options.closeOnOutside !== false) {
          void controller.close("outside");
        }
      },
      { signal: abort.signal }
    );
    element.addEventListener(
      "lyco-action",
      (event) => void handleAction(record, event as CustomEvent),
      { signal: abort.signal }
    );

    void controller.finished.then((result) => record.options.onClose?.(result));
    return record;
  };

  const mountRecord = async (record: DialogRecord<TResult>) => {
    active.push(record);
    ensureKeydown();

    record.previousFocus = document.activeElement;
    if (record.options.lockScroll !== false) {
      record.releaseScroll = lockDocumentScroll();
    }

    record.controller.setState("mounting");
    layer.mountItem(record.controller, layer.options.order);
    record.controller.setState("opening");
    await animatePopup(
      getDialogPanel(record.element),
      record.options.placement ?? layer.options.placement,
      "enter",
      record.options.animation ?? instanceOptions.animation,
      (ctx) => emitError(onError, { ...ctx, controller: record.controller })
    );
    if (record.controller.state !== "opening") return;

    record.controller.setState("open");
    record.options.onOpen?.(record.controller);

    if (record.options.trapFocus !== false || record.options.autofocus !== false) {
      const root = record.element.shadowRoot ?? record.element;
      focusInitial(root, getDialogPanel(record.element), record.options.autofocus);
    }
  };

  const open = (options: LycoDialogOptions<TResult>): LycoPopupController<TResult> => {
    if (mode === "single") {
      for (const record of [...active]) void record.controller.close("replaced");
    }

    const record = createRecord(options);
    void mountRecord(record);
    return record.controller;
  };

  const instance: LycoDialogInstance<TResult> = {
    open,

    async alert(optionsOrMessage: LycoDialogOptions<void> | string) {
      const options: LycoDialogOptions<void> =
        typeof optionsOrMessage === "string"
          ? { title: optionsOrMessage }
          : optionsOrMessage;
      const ctrl = open({
        ...options,
        actions: options.actions ?? [
          {
            text: "OK",
            role: "confirm",
            close: true,
          },
        ],
      } as unknown as LycoDialogOptions<TResult>);
      return (await ctrl.finished) as LycoCloseResult<void>;
    },

    async confirm(optionsOrMessage: LycoDialogOptions<boolean> | string) {
      const options: LycoDialogOptions<boolean> =
        typeof optionsOrMessage === "string"
          ? { title: optionsOrMessage }
          : optionsOrMessage;
      const ctrl = open({
        ...options,
        role: options.role ?? "alertdialog",
        tone: options.tone ?? "warning",
        actions: options.actions ?? [
          {
            text: "Cancel",
            role: "cancel",
            value: false,
            close: true,
          },
          {
            text: "OK",
            role: "confirm",
            value: true,
            close: true,
            autofocus: true,
          },
        ],
      } as unknown as LycoDialogOptions<TResult>);

      const result = await ctrl.finished;
      return result.value === true;
    },

    getCreateFn() {
      if (!createFn) createFn = open;
      return createFn;
    },

    closeAll(reason = "programmatic") {
      return Promise.all([...active].map((record) => record.controller.close(reason))).then(
        () => undefined
      );
    },

    hideAll() {
      layer.hideAll();
    },

    showAll() {
      layer.showAll();
    },

    getItems() {
      return active.map((record) => record.controller);
    },

    getKeys() {
      return active
        .map((record) => record.controller.key)
        .filter((key): key is string => typeof key === "string");
    },

    hasKey(key: string) {
      return active.some((record) => record.controller.key === key);
    },

    destroy() {
      void instance.closeAll("destroyed").finally(() => layer.destroy());
    },
  };

  return instance;
}
