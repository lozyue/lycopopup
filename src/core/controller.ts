import type {
  LycoCloseReason,
  LycoCloseResult,
  LycoPopupController,
  LycoPopupState,
  LycoPopupType,
} from "../lyco-shortcuts-types";
import { createDeferred } from "../utils/defer";

export interface InternalPopupController<TResult = unknown>
  extends LycoPopupController<TResult> {
  setState(state: LycoPopupState): void;
  settle(reason: LycoCloseReason, value?: TResult): void;
  setCloseHandler(
    handler: (reason: LycoCloseReason, value?: TResult) => Promise<void>
  ): void;
  setUpdateHandler(handler: (patch: unknown) => void): void;
  setFocusHandler(handler: (options?: FocusOptions) => boolean): void;
}

export interface PopupControllerOptions<TResult = unknown> {
  id: string;
  key?: string;
  type: LycoPopupType;
  element: HTMLElement;
  close?: (reason: LycoCloseReason, value?: TResult) => Promise<void>;
  update?: (patch: unknown) => void;
  focus?: (options?: FocusOptions) => boolean;
}

export function createPopupController<TResult = unknown>(
  options: PopupControllerOptions<TResult>
): InternalPopupController<TResult> {
  const deferred = createDeferred<LycoCloseResult<TResult>>();

  let state: LycoPopupState = "created";
  let closePromise: Promise<void> | null = null;
  let settled = false;
  let closeHandler =
    options.close ??
    (async () => {
      controller.settle("programmatic");
    });
  let updateHandler = options.update ?? (() => undefined);
  let focusHandler =
    options.focus ??
    ((focusOptions?: FocusOptions) => {
      options.element.focus(focusOptions);
      return document.activeElement === options.element;
    });

  const controller: InternalPopupController<TResult> = {
    id: options.id,
    key: options.key,
    type: options.type,
    element: options.element,
    finished: deferred.promise,

    get state() {
      return state;
    },

    close(reason = "programmatic", value?: TResult) {
      if (closePromise) return closePromise;

      closePromise = Promise.resolve()
        .then(async () => {
          await closeHandler(reason, value);
          if (state !== "closing" && state !== "closed" && state !== "destroyed") {
            closePromise = null;
          }
        })
        .catch((error) => {
          closePromise = null;
          throw error;
        });

      return closePromise;
    },

    update(patch: unknown) {
      updateHandler(patch);
    },

    focus(options?: FocusOptions) {
      return focusHandler(options);
    },

    setState(nextState: LycoPopupState) {
      state = nextState;
      options.element.dataset.lycoState = nextState;
      options.element.setAttribute("state", nextState);
      options.element.toggleAttribute("busy", nextState === "busy");
    },

    settle(reason: LycoCloseReason, value?: TResult) {
      if (settled) return;
      settled = true;
      state = "closed";
      options.element.dataset.lycoState = "closed";
      options.element.setAttribute("state", "closed");
      options.element.removeAttribute("busy");
      deferred.resolve({
        id: options.id,
        key: options.key,
        reason,
        value,
        closedAt: Date.now(),
      });
    },

    setCloseHandler(handler) {
      closeHandler = handler;
    },

    setUpdateHandler(handler) {
      updateHandler = handler;
    },

    setFocusHandler(handler) {
      focusHandler = handler;
    },
  };

  controller.setState("created");
  return controller;
}
