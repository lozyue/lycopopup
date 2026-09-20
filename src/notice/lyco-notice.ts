import type {
  LycoNoticeAction,
  LycoTone,
} from "../lyco-shortcuts-types";
import { createIconButton, renderActions, setOptionalContent, toneAttr } from "../components/component-utils";
import { defineCustomElement } from "../dom/define-element";

export interface LycoNoticeRenderModel<TResult = unknown> {
  title?: string | number | Node | null;
  message?: string | number | Node | null;
  content?: string | number | Node | null;
  tone?: LycoTone;
  closable?: boolean;
  actions?: LycoNoticeAction<TResult>[];
}

const NOTICE_STYLE = /*@plugin-css*/ `
  :host {
    display: block;
    width: var(--lyco-notice-width, min(92vw, 360px));
    color: var(--lyco-notice-fg, #111827);
  }

  .notice {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px 12px;
    box-sizing: border-box;
    padding: var(--lyco-notice-padding, 14px 16px);
    border: 1px solid var(--lyco-notice-border, rgb(229 231 235));
    border-left: 4px solid var(--lyco-notice-accent, #64748b);
    border-radius: var(--lyco-notice-radius, 8px);
    background: var(--lyco-notice-bg, white);
    box-shadow: var(--lyco-notice-shadow, 0 14px 36px rgb(15 23 42 / .16));
    font-size: 14px;
    line-height: 1.45;
  }

  :host([tone="info"]) .notice {
    --lyco-notice-accent: #2563eb;
  }

  :host([tone="success"]) .notice {
    --lyco-notice-accent: #059669;
  }

  :host([tone="warning"]) .notice {
    --lyco-notice-accent: #d97706;
  }

  :host([tone="danger"]) .notice {
    --lyco-notice-accent: #dc2626;
  }

  :host([tone="loading"]) .notice {
    --lyco-notice-accent: #6366f1;
  }

  .main {
    min-width: 0;
  }

  .title {
    margin: 0;
    font-weight: 650;
    color: var(--lyco-notice-title-fg, #111827);
    overflow-wrap: anywhere;
  }

  .message,
  .content {
    margin-top: 4px;
    color: var(--lyco-notice-message-fg, #4b5563);
    overflow-wrap: anywhere;
  }

  .message[hidden],
  .content[hidden],
  .title[hidden] {
    display: none;
  }

  .actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 2px;
  }

  .actions[empty] {
    display: none;
  }

  button {
    appearance: none;
    border: 1px solid rgb(209 213 219);
    border-radius: 6px;
    color: #111827;
    background: white;
    min-height: 30px;
    padding: 0 10px;
    font: inherit;
    cursor: pointer;
  }

  button[data-action-role="confirm"],
  button[data-action-role="danger"] {
    border-color: var(--lyco-notice-accent, #64748b);
    color: var(--lyco-notice-accent, #64748b);
  }

  button:hover {
    background: rgb(249 250 251);
  }

  button:disabled {
    opacity: .56;
    cursor: default;
  }

  .close {
    width: 28px;
    height: 28px;
    padding: 0;
    border-color: transparent;
    color: #6b7280;
    background: transparent;
    font-size: 16px;
    line-height: 1;
  }

  .close:hover {
    background: rgb(243 244 246);
  }

  .close[hidden] {
    display: none;
  }
`;

export class LycoNoticeElement extends HTMLElement {
  titleEl: HTMLDivElement;
  messageEl: HTMLDivElement;
  contentEl: HTMLDivElement;
  actionsEl: HTMLDivElement;
  closeButton: HTMLButtonElement;
  model: LycoNoticeRenderModel | null = null;

  static observedAttributes = ["title", "message", "tone"];

  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    const notice = document.createElement("article");
    const main = document.createElement("div");
    const title = document.createElement("div");
    const message = document.createElement("div");
    const content = document.createElement("div");
    const actions = document.createElement("div");
    const close = createIconButton("Close", "close");

    style.textContent = NOTICE_STYLE;
    notice.className = "notice";
    notice.part.add("notice");
    main.className = "main";
    title.className = "title";
    title.part.add("title");
    message.className = "message";
    message.part.add("message");
    content.className = "content";
    content.part.add("content");
    actions.className = "actions";
    actions.part.add("actions");
    close.classList.add("close");

    close.addEventListener("click", (event) => {
      this.dispatchEvent(
        new CustomEvent("lyco-close", {
          detail: { event },
          bubbles: true,
          composed: true,
        })
      );
    });

    main.append(title, message, content);
    notice.append(main, close, actions);
    root.append(style, notice);

    this.titleEl = title;
    this.messageEl = message;
    this.contentEl = content;
    this.actionsEl = actions;
    this.closeButton = close;
  }

  connectedCallback(): void {
    if (!this.model) {
      this.setModel({
        title: this.getAttribute("title") ?? "",
        message: this.getAttribute("message") ?? "",
        tone: (this.getAttribute("tone") as LycoTone | null) ?? "neutral",
        closable: true,
      });
    }
  }

  attributeChangedCallback(): void {
    if (!this.isConnected || !this.model) return;
    this.patchModel({
      title: this.getAttribute("title") ?? this.model.title,
      message: this.getAttribute("message") ?? this.model.message,
      tone: (this.getAttribute("tone") as LycoTone | null) ?? this.model.tone,
    });
  }

  setModel(model: LycoNoticeRenderModel): void {
    this.model = model;
    const tone = toneAttr(model.tone);
    const assertive = tone === "danger" || tone === "warning";

    this.setAttribute("tone", tone);
    this.shadowRoot
      ?.querySelector(".notice")
      ?.setAttribute("role", assertive ? "alert" : "status");
    this.shadowRoot
      ?.querySelector(".notice")
      ?.setAttribute("aria-live", assertive ? "assertive" : "polite");

    setOptionalContent(this.titleEl, model.title);
    setOptionalContent(this.messageEl, model.message);
    setOptionalContent(this.contentEl, model.content);
    renderActions(this.actionsEl, model.actions);
    this.closeButton.hidden = model.closable === false;
  }

  patchModel(patch: Partial<LycoNoticeRenderModel>): void {
    this.setModel({ ...(this.model ?? {}), ...patch });
  }
}

export function defineLycoNoticeElement(): CustomElementConstructor {
  return defineCustomElement("lyco-notice", LycoNoticeElement);
}

declare global {
  interface HTMLElementTagNameMap {
    "lyco-notice": LycoNoticeElement;
  }
}
