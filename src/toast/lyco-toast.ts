import type {
  LycoPopupContent,
  LycoToastAction,
  LycoTone,
} from "../lyco-shortcuts-types";
import { defineCustomElement } from "../dom/define-element";
import { createIconButton, renderActions, setOptionalContent, toneAttr } from "../components/component-utils";

export interface LycoToastRenderModel<TResult = unknown> {
  message?: string | number | Node | null;
  content?: string | number | Node | null;
  tone?: LycoTone;
  action?: LycoToastAction<TResult>;
  closable?: boolean;
}

const TOAST_STYLE = /*@plugin-css*/ `
  :host {
    display: block;
    max-width: var(--lyco-toast-max-width, min(80vw, 420px));
    color: var(--lyco-toast-fg, white);
  }

  .toast {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    box-sizing: border-box;
    padding: var(--lyco-toast-padding, 9px 14px);
    border-radius: var(--lyco-toast-radius, 8px);
    background: var(--lyco-toast-bg, rgb(20 20 20 / .9));
    box-shadow: var(--lyco-toast-shadow, 0 16px 36px rgb(0 0 0 / .22));
    font-size: 14px;
    line-height: 1.45;
  }

  :host([tone="success"]) .toast {
    background: var(--lyco-toast-success-bg, #047857);
  }

  :host([tone="warning"]) .toast {
    background: var(--lyco-toast-warning-bg, #92400e);
  }

  :host([tone="danger"]) .toast {
    background: var(--lyco-toast-danger-bg, #991b1b);
  }

  :host([tone="info"]) .toast {
    background: var(--lyco-toast-info-bg, #1d4ed8);
  }

  :host([tone="loading"]) .toast {
    background: var(--lyco-toast-loading-bg, #374151);
  }

  .content {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .actions[empty] {
    display: none;
  }

  button {
    appearance: none;
    border: 0;
    border-radius: 6px;
    color: inherit;
    background: rgb(255 255 255 / .14);
    min-height: 28px;
    padding: 0 9px;
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: rgb(255 255 255 / .22);
  }

  button:disabled {
    opacity: .56;
    cursor: default;
  }

  .close {
    width: 28px;
    padding: 0;
    font-size: 16px;
    line-height: 1;
  }

  .close[hidden] {
    display: none;
  }
`;

export class LycoToastElement extends HTMLElement {
  contentEl: HTMLDivElement;
  actionsEl: HTMLDivElement;
  closeButton: HTMLButtonElement;
  model: LycoToastRenderModel | null = null;

  static observedAttributes = ["message", "tone"];

  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    const toast = document.createElement("div");
    const content = document.createElement("div");
    const actions = document.createElement("div");
    const close = createIconButton("Close", "close");

    style.textContent = TOAST_STYLE;
    toast.className = "toast";
    toast.part.add("toast");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    content.className = "content";
    content.part.add("content");
    actions.className = "actions";
    actions.part.add("actions");
    close.classList.add("close");
    close.hidden = true;

    close.addEventListener("click", (event) => {
      this.dispatchEvent(
        new CustomEvent("lyco-close", {
          detail: { event },
          bubbles: true,
          composed: true,
        })
      );
    });

    toast.append(content, actions, close);
    root.append(style, toast);

    this.contentEl = content;
    this.actionsEl = actions;
    this.closeButton = close;
  }

  connectedCallback(): void {
    if (!this.model) {
      this.setModel({
        message: this.getAttribute("message") ?? this.textContent ?? "",
        tone: (this.getAttribute("tone") as LycoTone | null) ?? "neutral",
      });
    }
  }

  attributeChangedCallback(): void {
    if (!this.isConnected || !this.model) return;
    this.setModel({
      ...this.model,
      message: this.getAttribute("message") ?? this.model.message,
      tone: (this.getAttribute("tone") as LycoTone | null) ?? this.model.tone,
    });
  }

  setModel(model: LycoToastRenderModel): void {
    this.model = model;
    const tone = toneAttr(model.tone);
    this.setAttribute("tone", tone);
    setOptionalContent(this.contentEl, model.content ?? model.message);
    renderActions(
      this.actionsEl,
      model.action ? [model.action] : undefined
    );
    this.closeButton.hidden = !model.closable;
  }

  patchModel(patch: Partial<LycoToastRenderModel>): void {
    this.setModel({ ...(this.model ?? {}), ...patch });
  }
}

export function defineLycoToastElement(): CustomElementConstructor {
  return defineCustomElement("lyco-toast", LycoToastElement);
}

declare global {
  interface HTMLElementTagNameMap {
    "lyco-toast": LycoToastElement;
  }
}
