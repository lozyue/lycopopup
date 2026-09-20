export const enum LycoPopupKind {
  Dialog = "dialog",
  Notice = "notice",
  Toast = "toast",
  Custom = "custom",
}

export const enum LycoPopupStateName {
  Created = "created",
  Mounting = "mounting",
  Opening = "opening",
  Open = "open",
  Busy = "busy",
  Closing = "closing",
  Closed = "closed",
  Destroyed = "destroyed",
}

export const enum LycoCloseReasonName {
  Timeout = "timeout",
  Action = "action",
  Cancel = "cancel",
  Confirm = "confirm",
  Outside = "outside",
  Escape = "escape",
  Programmatic = "programmatic",
  Replaced = "replaced",
  Destroyed = "destroyed",
}

export type LycoPopupType = `${LycoPopupKind}`;

export type LycoPopupState = `${LycoPopupStateName}`;

export type LycoCloseReason = `${LycoCloseReasonName}`;

export type LycoTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "loading";

export type LycoPlacement =
  | "top"
  | "top-start"
  | "top-end"
  | "right"
  | "right-start"
  | "right-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "left"
  | "left-start"
  | "left-end"
  | "center";

export type LycoLayerPositionStrategy = "fixed" | "absolute";

export type LycoLayerOrder = "newest-first" | "oldest-first";

export type LycoAnimationPreset =
  | "fade"
  | "scale"
  | "slide"
  | "slide-fade"
  | "toast"
  | "none";

export type LycoStyleVars = Record<`--${string}`, string | number | null | undefined>;

export type LycoAttrs = Record<string, string | number | boolean | null | undefined>;

export type LycoPopupContent =
  | string
  | number
  | Node
  | DocumentFragment
  | null
  | undefined
  | ((ctx: LycoRenderContext) => string | number | Node | DocumentFragment | null | undefined);

export interface LycoCloseResult<TResult = unknown> {
  id: string;
  key?: string;
  reason: LycoCloseReason;
  value?: TResult;
  closedAt: number;
}

export interface LycoPopupController<TResult = unknown> {
  readonly id: string;
  readonly key?: string;
  readonly type: LycoPopupType;
  readonly state: LycoPopupState;
  readonly element: HTMLElement;
  readonly finished: Promise<LycoCloseResult<TResult>>;

  close(reason?: LycoCloseReason, value?: TResult): Promise<void>;
  update(patch: unknown): void;
  focus(options?: FocusOptions): boolean;
}

export interface LycoRenderContext<TResult = unknown> {
  id: string;
  key?: string;
  close(value?: TResult, reason?: LycoCloseReason): Promise<void>;
  update(patch: unknown): void;
  signal: AbortSignal;
}

export interface LycoBeforeCloseContext<TResult = unknown> {
  reason: LycoCloseReason;
  value?: TResult;
  controller: LycoPopupController<TResult>;
}

export interface LycoErrorContext<TResult = unknown> {
  phase:
    | "render"
    | "action"
    | "before-close"
    | "close"
    | "animation"
    | "lifecycle";
  error: unknown;
  controller?: LycoPopupController<TResult>;
}

export interface LycoAnimationOptions {
  preset?: LycoAnimationPreset;
  enter?: Keyframe[];
  exit?: Keyframe[];
  duration?: number;
  exitDuration?: number;
  easing?: string;
  respectReducedMotion?: boolean;
}

export interface LycoPopupLayerOptions {
  placement?: LycoPlacement;
  mountTo?: HTMLElement | ShadowRoot;
  zIndex?: number | string;
  positionStrategy?: LycoLayerPositionStrategy;
  order?: LycoLayerOrder;
  gap?: number | string;
  padding?: string;
  className?: string;
  styleVars?: LycoStyleVars;
}

export interface LycoPopupLayerController {
  readonly element: HTMLElement;

  closeAll(reason?: LycoCloseReason): Promise<void>;
  hideAll(): void;
  showAll(): void;

  getItems(): LycoPopupController[];
  getKeys(): string[];
  hasKey(key: string): boolean;

  setDisabled(disabled: boolean): void;
  destroy(): void;
}

export type LycoLayerInput = LycoPopupLayerController | LycoPopupLayerOptions;

export interface LycoPopupOpenBase<TResult = unknown> {
  id?: string;
  key?: string;
  element?: string | HTMLElement;
  duration?: number;
  animation?: LycoAnimationOptions;
  styleVars?: LycoStyleVars;
  attrs?: LycoAttrs;
  className?: string;
  priority?: number;
  onOpen?: (controller: LycoPopupController<TResult>) => void;
  onBeforeClose?: (
    ctx: LycoBeforeCloseContext<TResult>
  ) => void | boolean | Promise<void | boolean>;
  onClose?: (result: LycoCloseResult<TResult>) => void;
}

export interface LycoInstanceBaseOptions {
  layer?: LycoLayerInput;
  animation?: LycoAnimationOptions;
  autoDefine?: boolean;
  onError?: (ctx: LycoErrorContext) => void;
}

export interface LycoActionContext<TResult = unknown> {
  controller: LycoPopupController<TResult>;
  close(reason?: LycoCloseReason, value?: TResult): Promise<void>;
  update(patch: unknown): void;
  event: Event;
  signal: AbortSignal;
}

export interface LycoPopupAction<TResult = unknown> {
  id?: string;
  text: string;
  value?: TResult;
  role?: "confirm" | "cancel" | "neutral" | "danger";
  close?: boolean;
  disabled?: boolean;
  loading?: boolean;
  autofocus?: boolean;
  tabIndex?: number;
  order?: number;
  onClick?: (
    ctx: LycoActionContext<TResult>
  ) => void | boolean | Promise<void | boolean>;
}

export interface LycoNoticeAction<TResult = unknown>
  extends LycoPopupAction<TResult> {}

export interface LycoToastAction<TResult = unknown>
  extends LycoPopupAction<TResult> {}

export interface LycoDialogAction<TResult = unknown>
  extends LycoPopupAction<TResult> {}

export interface LycoNoticeOptions<TResult = unknown>
  extends LycoPopupOpenBase<TResult> {
  title?: LycoPopupContent;
  message?: LycoPopupContent;
  content?: LycoPopupContent;
  tone?: LycoTone;
  closable?: boolean;
  pauseOnHover?: boolean;
  actions?: LycoNoticeAction<TResult>[];
}

export interface LycoNoticeStackPolicy {
  maxVisible?: number;
  maxPending?: number;
  overflow?: "queue" | "drop-oldest" | "drop-newest" | "replace-lowest-priority";
  keyedDuplicate?: "update" | "replace" | "ignore";
  updateMode?: "patch" | "replace";
  order?: LycoLayerOrder;
}

export interface LycoNoticeInstanceOptions<TResult = unknown>
  extends LycoInstanceBaseOptions {
  defaults?: Partial<LycoNoticeOptions<TResult>>;
  stack?: LycoNoticeStackPolicy;
}

export interface LycoNoticeInstance<TResult = unknown> {
  open(options: LycoNoticeOptions<TResult>): LycoPopupController<TResult>;
  getCreateFn(): (options: LycoNoticeOptions<TResult>) => LycoPopupController<TResult>;
  closeAll(reason?: LycoCloseReason): Promise<void>;
  hideAll(): void;
  showAll(): void;
  getItems(): LycoPopupController<TResult>[];
  getKeys(): string[];
  hasKey(key: string): boolean;
  destroy(): void;
}

export interface LycoToastOptions<TResult = unknown>
  extends LycoPopupOpenBase<TResult> {
  message?: LycoPopupContent;
  content?: LycoPopupContent;
  tone?: LycoTone;
  action?: LycoToastAction<TResult>;
  closable?: boolean;
  replace?: boolean;
  pauseOnHover?: boolean;
}

export interface LycoToastInstanceOptions<TResult = unknown>
  extends LycoInstanceBaseOptions {
  defaults?: Partial<LycoToastOptions<TResult>>;
}

export interface LycoToastInstance<TResult = unknown> {
  open(
    messageOrOptions: string | number | LycoToastOptions<TResult>
  ): LycoPopupController<TResult>;
  getCreateFn(): (
    messageOrOptions: string | number | LycoToastOptions<TResult>
  ) => LycoPopupController<TResult>;
  closeAll(reason?: LycoCloseReason): Promise<void>;
  hideAll(): void;
  showAll(): void;
  destroy(): void;
}

export type LycoDialogVariant = "dialog" | "drawer" | "sheet";

export interface LycoDialogBusyContext {
  reason: "action" | "submit" | "custom";
  actionId?: string;
  onFinish(cb: () => void): boolean;
}

export interface LycoDialogOptions<TResult = unknown>
  extends LycoPopupOpenBase<TResult> {
  title?: LycoPopupContent;
  content?: LycoPopupContent;
  message?: LycoPopupContent;
  tone?: LycoTone;
  variant?: LycoDialogVariant;
  placement?: LycoPlacement;
  role?: "dialog" | "alertdialog";
  actions?: LycoDialogAction<TResult>[];

  scrim?: boolean;
  pointerBlock?: boolean;
  closeOnOutside?: boolean;
  closeOnEscape?: boolean;
  closeWhenBusy?: boolean;
  trapFocus?: boolean;
  restoreFocus?: boolean;
  lockScroll?: boolean;

  showClose?: boolean;
  layout?: "default" | "form";
  bodyPadding?: boolean;
  footerPadding?: boolean;
  autofocus?: boolean | string;

  onBusy?: (ctx: LycoDialogBusyContext) => void;
}

export interface LycoDialogInstanceOptions<TResult = unknown>
  extends LycoInstanceBaseOptions {
  defaults?: Partial<LycoDialogOptions<TResult>>;
  mode?: "single" | "stack";
}

export interface LycoDialogInstance<TResult = unknown> {
  open(options: LycoDialogOptions<TResult>): LycoPopupController<TResult>;
  alert(options: LycoDialogOptions<void> | string): Promise<LycoCloseResult<void>>;
  confirm(options: LycoDialogOptions<boolean> | string): Promise<boolean>;
  getCreateFn(): (options: LycoDialogOptions<TResult>) => LycoPopupController<TResult>;
  closeAll(reason?: LycoCloseReason): Promise<void>;
  hideAll(): void;
  showAll(): void;
  getItems(): LycoPopupController<TResult>[];
  getKeys(): string[];
  hasKey(key: string): boolean;
  destroy(): void;
}

export interface LycoElementControllerOptions<TResult = unknown> {
  type?: LycoPopupType;
  tag?: string;
  element?: HTMLElement;
  layer?: LycoLayerInput;
  props?: Record<string, unknown>;
  content?: LycoPopupContent;
  key?: string;
  animation?: LycoAnimationOptions;
  styleVars?: LycoStyleVars;
  attrs?: LycoAttrs;
  className?: string;
  onError?: (ctx: LycoErrorContext<TResult>) => void;
}

export interface LycoElementControllerResult<TResult = unknown> {
  element: HTMLElement;
  controller: LycoPopupController<TResult>;
}
