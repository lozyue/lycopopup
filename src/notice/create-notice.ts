import type {
  LycoActionContext,
  LycoCloseReason,
  LycoErrorContext,
  LycoNoticeAction,
  LycoNoticeInstance,
  LycoNoticeInstanceOptions,
  LycoNoticeOptions,
  LycoNoticeStackPolicy,
  LycoPopupController,
  LycoRenderContext,
  LycoAnimationOptions,
} from "../lyco-shortcuts-types";
import { animatePopup } from "../animation/animate";
import { captureFlip, playFlip } from "../animation/flip";
import {
  DEFAULT_ANIMATION_DURATION,
  DEFAULT_ANIMATION_EASING,
} from "../animation/presets";
import { prefersReducedMotion } from "../animation/reduced-motion";
import { createPopupController, type InternalPopupController } from "../core/controller";
import {
  applyElementOptions,
  createElementFromInput,
  resolveModelContent,
  setElementModel,
} from "../core/element";
import { resolveLayer } from "../layer/resolve-layer";
import type { LycoLayerControllerInternal } from "../layer/layer-controller";
import { defineLycoNoticeElement, type LycoNoticeRenderModel } from "./lyco-notice";
import { createLycoId } from "../utils/id";
import { createPausableTimer, type PausableTimer } from "../utils/timer";
import {
  comparePriority,
  getRoleCloseReason,
  isRecord,
  mergeDefined,
  normalizeDuration,
  normalizePositiveInteger,
} from "../utils/pure";

interface NoticeRecord<TResult> {
  options: LycoNoticeOptions<TResult>;
  element: HTMLElement;
  controller: InternalPopupController<TResult>;
  abort: AbortController;
  timer: PausableTimer | null;
  ctx: LycoRenderContext<TResult>;
  mounted: boolean;
  updateJob: NoticeUpdateJob<TResult> | null;
}

type NoticeUpdatePhase = "fade-out" | "content-updated" | "fade-in";

interface NoticeUpdateJob<TResult> {
  phase: NoticeUpdatePhase;
  patch: Partial<LycoNoticeOptions<TResult>>;
  animation: Animation | null;
  cancelled: boolean;
}

const DEFAULT_NOTICE_OPTIONS: Partial<LycoNoticeOptions> = {
  tone: "neutral",
  closable: true,
  pauseOnHover: true,
};

const DEFAULT_STACK: Required<LycoNoticeStackPolicy> = {
  maxVisible: 5,
  maxPending: 20,
  overflow: "queue",
  keyedDuplicate: "update",
  updateMode: "patch",
  order: "oldest-first",
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

function getNoticeDuration<TResult>(options: LycoNoticeOptions<TResult>): number {
  const fallback = options.tone === "loading" ? 0 : 4500;
  return normalizeDuration(options.duration, fallback);
}

function buildNoticeModel<TResult>(
  record: NoticeRecord<TResult>,
  onError?: (ctx: LycoErrorContext<TResult>) => void
): LycoNoticeRenderModel<TResult> {
  const { options, ctx } = record;
  const reportRenderError = (error: unknown) =>
    emitError(onError, { phase: "render", error, controller: record.controller });

  return {
    title: resolveModelContent(options.title, ctx, reportRenderError),
    message: resolveModelContent(options.message, ctx, reportRenderError),
    content: resolveModelContent(options.content, ctx, reportRenderError),
    tone: options.tone,
    closable: options.closable,
    actions: options.actions,
  };
}

function removeRecord<TResult>(
  list: NoticeRecord<TResult>[],
  record: NoticeRecord<TResult>
): void {
  const index = list.indexOf(record);
  if (index >= 0) list.splice(index, 1);
}

function shouldSkipUpdateMotion(options?: LycoAnimationOptions): boolean {
  if (options?.preset === "none") return true;
  if ((options?.respectReducedMotion ?? true) && prefersReducedMotion()) return true;
  return typeof Element.prototype.animate !== "function";
}

function getCurrentOpacity(element: HTMLElement): number {
  const value = Number(window.getComputedStyle(element).opacity);
  return Number.isFinite(value) ? value : 1;
}

function getUpdateTimings(options?: LycoAnimationOptions): {
  fadeOut: number;
  fadeIn: number;
  easing: string;
} {
  const base = options?.duration ?? DEFAULT_ANIMATION_DURATION;

  return {
    fadeOut: options?.exitDuration ?? Math.max(60, Math.round(base * 0.45)),
    fadeIn: base || DEFAULT_ANIMATION_DURATION,
    easing: options?.easing ?? DEFAULT_ANIMATION_EASING,
  };
}

function startOpacityAnimation(
  element: HTMLElement,
  from: number,
  to: number,
  duration: number,
  easing: string
): Animation | null {
  if (duration <= 0 || typeof element.animate !== "function") {
    element.style.opacity = String(to);
    return null;
  }

  return element.animate([{ opacity: from }, { opacity: to }], {
    duration,
    easing,
    fill: "forwards",
  });
}

async function waitAnimation(animation: Animation | null): Promise<boolean> {
  if (!animation) return true;

  try {
    await animation.finished;
    return true;
  } catch {
    return false;
  }
}

export function createLycoNotice<TResult = unknown>(
  instanceOptions: LycoNoticeInstanceOptions<TResult> = {}
): LycoNoticeInstance<TResult> {
  if (instanceOptions.autoDefine !== false) defineLycoNoticeElement();

  const stack: Required<LycoNoticeStackPolicy> = {
    ...DEFAULT_STACK,
    ...instanceOptions.stack,
  };
  stack.maxVisible = normalizePositiveInteger(stack.maxVisible, DEFAULT_STACK.maxVisible);
  stack.maxPending = normalizePositiveInteger(stack.maxPending, DEFAULT_STACK.maxPending);

  const layer = resolveLayer(instanceOptions.layer, {
    placement: "top-end",
    zIndex: 5100,
    order: stack.order,
  });
  const onError = instanceOptions.onError;
  const active: NoticeRecord<TResult>[] = [];
  const pending: NoticeRecord<TResult>[] = [];
  const keyed = new Map<string, NoticeRecord<TResult>>();

  let createFn:
    | ((options: LycoNoticeOptions<TResult>) => LycoPopupController<TResult>)
    | null = null;

  const forgetKey = (record: NoticeRecord<TResult>) => {
    if (record.options.key && keyed.get(record.options.key) === record) {
      keyed.delete(record.options.key);
    }
  };

  const setUpdatePhase = (
    record: NoticeRecord<TResult>,
    phase: NoticeUpdatePhase | null
  ) => {
    if (phase) {
      record.element.setAttribute("update-state", phase);
      record.element.dataset.lycoUpdateState = phase;
    } else {
      record.element.removeAttribute("update-state");
      delete record.element.dataset.lycoUpdateState;
    }
  };

  const combineUpdatePatch = (
    current: Partial<LycoNoticeOptions<TResult>>,
    patch: Partial<LycoNoticeOptions<TResult>>
  ) =>
    stack.updateMode === "replace"
      ? patch
      : mergeDefined<LycoNoticeOptions<TResult>>(current, patch);

  const syncNoticeTimer = (record: NoticeRecord<TResult>) => {
    record.timer?.clear();
    record.timer = null;

    if (!record.mounted || record.controller.state !== "open") return;

    const duration = getNoticeDuration(record.options);
    if (duration > 0) {
      record.timer = createPausableTimer(
        () => void record.controller.close("timeout"),
        duration
      );
    }
  };

  const commitNoticePatch = (
    record: NoticeRecord<TResult>,
    rawPatch: Partial<LycoNoticeOptions<TResult>>
  ) => {
    const previousKey = record.options.key;
    const nextOptions =
      stack.updateMode === "replace"
        ? mergeDefined<LycoNoticeOptions<TResult>>(
            DEFAULT_NOTICE_OPTIONS as Partial<LycoNoticeOptions<TResult>>,
            instanceOptions.defaults,
            rawPatch
          )
        : mergeDefined<LycoNoticeOptions<TResult>>(record.options, rawPatch);

    record.options = nextOptions;

    if (
      previousKey &&
      previousKey !== nextOptions.key &&
      keyed.get(previousKey) === record
    ) {
      keyed.delete(previousKey);
    }
    if (nextOptions.key) keyed.set(nextOptions.key, record);

    setElementModel(record.element, buildNoticeModel(record, onError));
  };

  const bringNoticeToTop = (record: NoticeRecord<TResult>) => {
    const index = active.indexOf(record);
    if (index > 0) {
      active.splice(index, 1);
      active.unshift(record);
    }

    if (
      record.element.parentNode === layer.element &&
      layer.element.firstElementChild !== record.element
    ) {
      layer.element.insertBefore(record.element, layer.element.firstElementChild);
    }
  };

  const cancelNoticeUpdate = (record: NoticeRecord<TResult>, keepOpacity = false) => {
    const job = record.updateJob;
    if (!job) return;

    const opacity = keepOpacity ? getCurrentOpacity(record.element) : null;
    job.cancelled = true;
    job.animation?.cancel();
    record.updateJob = null;

    if (opacity === null) record.element.style.opacity = "";
    else record.element.style.opacity = String(opacity);
    setUpdatePhase(record, null);
  };

  const finishNoticeUpdate = (record: NoticeRecord<TResult>, job: NoticeUpdateJob<TResult>) => {
    if (record.updateJob !== job) return;

    job.animation?.cancel();
    record.updateJob = null;
    record.element.style.opacity = "";
    setUpdatePhase(record, null);
    syncNoticeTimer(record);
  };

  const runNoticeUpdate = async (
    record: NoticeRecord<TResult>,
    patch: Partial<LycoNoticeOptions<TResult>>
  ) => {
    const animationOptions = record.options.animation ?? instanceOptions.animation;
    const job: NoticeUpdateJob<TResult> = {
      phase: "fade-out",
      patch,
      animation: null,
      cancelled: false,
    };

    record.updateJob = job;
    record.timer?.pause();
    setUpdatePhase(record, "fade-out");

    if (shouldSkipUpdateMotion(animationOptions)) {
      const flip = captureFlip(active.map((item) => item.element));
      commitNoticePatch(record, job.patch);
      bringNoticeToTop(record);
      playFlip(flip, animationOptions);
      finishNoticeUpdate(record, job);
      return;
    }

    const timings = getUpdateTimings(animationOptions);
    job.animation = startOpacityAnimation(
      record.element,
      getCurrentOpacity(record.element),
      0,
      timings.fadeOut,
      timings.easing
    );

    const fadedOut = await waitAnimation(job.animation);
    if (!fadedOut || record.updateJob !== job || job.cancelled) return;

    job.animation?.cancel();
    record.element.style.opacity = "0";
    job.phase = "content-updated";
    job.animation = null;
    setUpdatePhase(record, "content-updated");

    const flip = captureFlip(active.map((item) => item.element));
    commitNoticePatch(record, job.patch);
    bringNoticeToTop(record);
    playFlip(flip, animationOptions);

    if (record.updateJob !== job || job.cancelled) return;

    job.phase = "fade-in";
    setUpdatePhase(record, "fade-in");
    job.animation = startOpacityAnimation(
      record.element,
      0,
      1,
      timings.fadeIn,
      timings.easing
    );

    const fadedIn = await waitAnimation(job.animation);
    if (!fadedIn || record.updateJob !== job || job.cancelled) return;

    finishNoticeUpdate(record, job);
  };

  const closeRecord = async (
    record: NoticeRecord<TResult>,
    reason: LycoCloseReason,
    value?: TResult
  ) => {
    if (record.controller.state === "closing" || record.controller.state === "destroyed") {
      return;
    }

    cancelNoticeUpdate(record);

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
    forgetKey(record);

    if (!record.mounted) {
      removeRecord(pending, record);
      record.controller.settle(reason, value);
      record.controller.setState("destroyed");
      record.abort.abort();
      return;
    }

    const flip = captureFlip(active.map((item) => item.element));
    record.controller.setState("closing");
    await animatePopup(
      record.element,
      layer.options.placement,
      "exit",
      record.options.animation ?? instanceOptions.animation,
      (ctx) => emitError(onError, { ...ctx, controller: record.controller })
    );

    removeRecord(active, record);
    layer.unmountItem(record.controller);
    playFlip(flip, record.options.animation ?? instanceOptions.animation);
    record.controller.settle(reason, value);
    record.controller.setState("destroyed");
    record.abort.abort();
    mountPending();
  };

  const updateRecord = (
    record: NoticeRecord<TResult>,
    rawPatch: Partial<LycoNoticeOptions<TResult>>
  ) => {
    if (!record.mounted || record.controller.state === "created") {
      commitNoticePatch(record, rawPatch);
      return;
    }

    if (record.updateJob?.phase === "fade-out") {
      record.updateJob.patch = combineUpdatePatch(record.updateJob.patch, rawPatch);
      return;
    }

    if (record.updateJob) cancelNoticeUpdate(record, true);
    void runNoticeUpdate(record, rawPatch);
  };

  const handleAction = async (
    record: NoticeRecord<TResult>,
    event: CustomEvent
  ) => {
    const action = event.detail?.action as LycoNoticeAction<TResult> | undefined;
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

  const createRecord = (
    rawOptions: LycoNoticeOptions<TResult>
  ): NoticeRecord<TResult> => {
    const options = mergeDefined<LycoNoticeOptions<TResult>>(
      DEFAULT_NOTICE_OPTIONS as Partial<LycoNoticeOptions<TResult>>,
      instanceOptions.defaults,
      rawOptions
    );
    const element = createElementFromInput(options.element, "lyco-notice");
    const abort = new AbortController();
    const id = options.id ?? createLycoId("lyco-notice");

    const controller = createPopupController<TResult>({
      id,
      key: options.key,
      type: "notice",
      element,
    });

    const ctx: LycoRenderContext<TResult> = {
      id,
      key: options.key,
      close: (value, reason = "programmatic") => controller.close(reason, value),
      update: (patch) => controller.update(patch),
      signal: abort.signal,
    };

    const record: NoticeRecord<TResult> = {
      options,
      element,
      controller,
      abort,
      timer: null,
      ctx,
      mounted: false,
      updateJob: null,
    };

    controller.setCloseHandler((reason, value) => closeRecord(record, reason, value));
    controller.setUpdateHandler((patch) => {
      if (isRecord(patch)) updateRecord(record, patch as Partial<LycoNoticeOptions<TResult>>);
    });
    controller.setFocusHandler((focusOptions) => {
      element.focus(focusOptions);
      return document.activeElement === element;
    });

    applyElementOptions(element, options);
    setElementModel(element, buildNoticeModel(record, onError));

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

    if (options.key) keyed.set(options.key, record);
    void controller.finished.then((result) => record.options.onClose?.(result));
    return record;
  };

  const mountRecord = async (record: NoticeRecord<TResult>) => {
    if (record.mounted || record.controller.state !== "created") return;

    record.mounted = true;
    record.controller.setState("mounting");
    layer.mountItem(record.controller, stack.order);
    record.controller.setState("opening");
    await animatePopup(
      record.element,
      layer.options.placement,
      "enter",
      record.options.animation ?? instanceOptions.animation,
      (ctx) => emitError(onError, { ...ctx, controller: record.controller })
    );
    if ((record.controller.state as string) !== "opening") return;

    record.controller.setState("open");
    record.options.onOpen?.(record.controller);
    syncNoticeTimer(record);
  };

  function mountPending(): void {
    while (active.length < stack.maxVisible && pending.length > 0) {
      const next = pending.shift()!;
      active.push(next);
      void mountRecord(next);
    }
  }

  const dropRecord = (record: NoticeRecord<TResult>, reason: LycoCloseReason) => {
    void record.controller.close(reason);
  };

  const enqueueRecord = (record: NoticeRecord<TResult>) => {
    if (active.length < stack.maxVisible) {
      active.push(record);
      void mountRecord(record);
      return;
    }

    switch (stack.overflow) {
      case "drop-newest":
        dropRecord(record, "destroyed");
        return;
      case "drop-oldest": {
        const oldest = active[0];
        if (oldest) void oldest.controller.close("replaced");
        active.push(record);
        void mountRecord(record);
        return;
      }
      case "replace-lowest-priority": {
        const lowest = [...active, ...pending].sort((a, b) =>
          comparePriority(a.options, b.options)
        )[0];
        if (lowest && comparePriority(record.options, lowest.options) > 0) {
          void lowest.controller.close("replaced");
          active.push(record);
          void mountRecord(record);
        } else {
          dropRecord(record, "destroyed");
        }
        return;
      }
      case "queue":
      default:
        if (pending.length < stack.maxPending) {
          pending.push(record);
        } else {
          dropRecord(record, "destroyed");
        }
    }
  };

  const open = (options: LycoNoticeOptions<TResult>): LycoPopupController<TResult> => {
    if (options.key) {
      const existing = keyed.get(options.key);
      if (existing) {
        if (stack.keyedDuplicate === "ignore") return existing.controller;
        if (stack.keyedDuplicate === "update") {
          updateRecord(existing, options);
          return existing.controller;
        }
        void existing.controller.close("replaced");
      }
    }

    const record = createRecord(options);
    enqueueRecord(record);
    return record.controller;
  };

  const instance: LycoNoticeInstance<TResult> = {
    open,

    getCreateFn() {
      if (!createFn) createFn = open;
      return createFn;
    },

    async closeAll(reason = "programmatic") {
      await Promise.all(
        [...active, ...pending].map((record) => record.controller.close(reason))
      );
    },

    hideAll() {
      layer.hideAll();
    },

    showAll() {
      layer.showAll();
    },

    getItems() {
      return [...active, ...pending].map((record) => record.controller);
    },

    getKeys() {
      return Array.from(keyed.keys());
    },

    hasKey(key: string) {
      return keyed.has(key);
    },

    destroy() {
      void instance.closeAll("destroyed").finally(() => layer.destroy());
    },
  };

  return instance;
}
