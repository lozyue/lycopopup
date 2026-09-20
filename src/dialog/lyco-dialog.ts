import type {
  LycoDialogAction,
  LycoDialogVariant,
  LycoPlacement,
  LycoTone,
} from "../lyco-shortcuts-types";
import { createIconButton, renderActions, setOptionalContent, toneAttr } from "../components/component-utils";
import { defineCustomElement } from "../dom/define-element";

export interface LycoDialogRenderModel<TResult = unknown> {
  title?: string | number | Node | null;
  content?: string | number | Node | null;
  message?: string | number | Node | null;
  tone?: LycoTone;
  variant?: LycoDialogVariant;
  placement?: LycoPlacement;
  role?: "dialog" | "alertdialog";
  actions?: LycoDialogAction<TResult>[];
  scrim?: boolean;
  pointerBlock?: boolean;
  showClose?: boolean;
  layout?: "default" | "form";
  bodyPadding?: boolean;
  footerPadding?: boolean;
}

const DIALOG_STYLE = /*@plugin-css*/ `
  :host {
    display: block;
    width: 100%;
    min-height: 100%;
    color: var(--lyco-dialog-fg, #111827);
    pointer-events: auto;
  }

  .root {
    position: relative;
    width: 100%;
    min-height: 100%;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: var(--lyco-dialog-scrim-bg, rgb(15 23 42 / .42));
  }

  .scrim[hidden] {
    display: none;
  }

  .scrim[passive] {
    pointer-events: none;
  }

  .stage {
    position: relative;
    z-index: 1;
    min-height: 100%;
    box-sizing: border-box;
    display: flex;
    padding: var(--lyco-dialog-stage-padding, 20px);
  }

  :host([placement="center"]) .stage {
    align-items: center;
    justify-content: center;
  }

  :host([placement^="top"]) .stage {
    align-items: flex-start;
    justify-content: center;
  }

  :host([placement^="bottom"]) .stage {
    align-items: flex-end;
    justify-content: center;
  }

  :host([placement^="left"]) .stage {
    align-items: stretch;
    justify-content: flex-start;
    padding: 0;
  }

  :host([placement^="right"]) .stage {
    align-items: stretch;
    justify-content: flex-end;
    padding: 0;
  }

  .panel {
    outline: none;
    box-sizing: border-box;
    width: var(--lyco-dialog-width, min(92vw, 480px));
    max-width: var(--lyco-dialog-max-width, 92vw);
    max-height: var(--lyco-dialog-max-height, min(84vh, 760px));
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    overflow: hidden;
    border-radius: var(--lyco-dialog-radius, 12px);
    background: var(--lyco-dialog-bg, white);
    box-shadow: var(--lyco-dialog-shadow, 0 24px 64px rgb(15 23 42 / .24));
  }

  :host([variant="drawer"]) .panel {
    width: var(--lyco-drawer-width, min(92vw, 420px));
    max-width: 100vw;
    max-height: none;
    height: 100vh;
    border-radius: 0;
  }

  :host([variant="sheet"]) .panel {
    width: min(100vw, var(--lyco-sheet-width, 720px));
    max-width: 100vw;
    max-height: var(--lyco-sheet-max-height, 86vh);
    border-radius: var(--lyco-sheet-radius, 16px) var(--lyco-sheet-radius, 16px) 0 0;
  }

  .header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: start;
    padding: var(--lyco-dialog-header-padding, 20px 20px 0);
  }

  .title {
    margin: 0;
    font-size: var(--lyco-dialog-title-size, 18px);
    line-height: 1.25;
    font-weight: 680;
    overflow-wrap: anywhere;
  }

  .title[hidden] {
    display: none;
  }

  .close {
    appearance: none;
    border: 0;
    border-radius: 6px;
    width: 32px;
    height: 32px;
    padding: 0;
    color: #6b7280;
    background: transparent;
    font: inherit;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }

  .close:hover {
    background: rgb(243 244 246);
  }

  .close[hidden] {
    display: none;
  }

  .body {
    min-height: 0;
    overflow: auto;
    padding: var(--lyco-dialog-body-padding, 20px);
    color: var(--lyco-dialog-body-fg, #374151);
    font-size: 14px;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  :host([body-padding="false"]) .body {
    padding: 0;
  }

  .message[hidden],
  .content[hidden] {
    display: none;
  }

  .content:not([hidden]) {
    margin-top: 8px;
  }

  :host([layout="form"]) .content:not([hidden]) {
    margin-top: 0;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: var(--lyco-dialog-footer-padding, 0 20px 20px);
  }

  :host([footer-padding="false"]) .footer {
    padding: 0;
  }

  .footer[empty] {
    display: none;
  }

  button[part="action"] {
    appearance: none;
    border: 1px solid rgb(209 213 219);
    border-radius: 6px;
    min-height: 34px;
    padding: 0 13px;
    color: #111827;
    background: white;
    font: inherit;
    cursor: pointer;
  }

  button[part="action"]:hover {
    background: rgb(249 250 251);
  }

  button[data-action-role="confirm"] {
    border-color: #2563eb;
    background: #2563eb;
    color: white;
  }

  button[data-action-role="danger"] {
    border-color: #dc2626;
    background: #dc2626;
    color: white;
  }

  button[data-action-role="cancel"] {
    color: #374151;
  }

  button:disabled,
  button[loading] {
    opacity: .58;
    cursor: default;
  }

  :host([busy]) button[part="action"]:not([data-action-role="cancel"]) {
    cursor: progress;
  }
`;

export class LycoDialogElement extends HTMLElement {
  rootEl: HTMLDivElement;
  scrimEl: HTMLDivElement;
  panelEl: HTMLElement;
  titleEl: HTMLHeadingElement;
  messageEl: HTMLDivElement;
  contentEl: HTMLDivElement;
  footerEl: HTMLElement;
  closeButton: HTMLButtonElement;
  model: LycoDialogRenderModel | null = null;

  static observedAttributes = ["title", "tone", "variant", "placement"];

  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    const wrapper = document.createElement("div");
    const scrim = document.createElement("div");
    const stage = document.createElement("div");
    const panel = document.createElement("section");
    const header = document.createElement("header");
    const title = document.createElement("h2");
    const close = createIconButton("Close", "close");
    const body = document.createElement("div");
    const message = document.createElement("div");
    const content = document.createElement("div");
    const footer = document.createElement("footer");

    style.textContent = DIALOG_STYLE;
    wrapper.className = "root";
    scrim.className = "scrim";
    scrim.part.add("scrim");
    stage.className = "stage";
    stage.part.add("stage");
    panel.className = "panel";
    panel.part.add("panel");
    panel.tabIndex = -1;
    header.className = "header";
    header.part.add("header");
    title.className = "title";
    title.part.add("title");
    close.classList.add("close");
    body.className = "body";
    body.part.add("body");
    message.className = "message";
    message.part.add("message");
    content.className = "content";
    content.part.add("content");
    footer.className = "footer";
    footer.part.add("footer");

    const titleId = `lyco-dialog-title-${Math.random().toString(36).slice(2)}`;
    const bodyId = `lyco-dialog-body-${Math.random().toString(36).slice(2)}`;
    title.id = titleId;
    body.id = bodyId;
    panel.setAttribute("aria-labelledby", titleId);
    panel.setAttribute("aria-describedby", bodyId);

    scrim.addEventListener("click", (event) => {
      this.dispatchEvent(
        new CustomEvent("lyco-outside", {
          detail: { event },
          bubbles: true,
          composed: true,
        })
      );
    });

    close.addEventListener("click", (event) => {
      this.dispatchEvent(
        new CustomEvent("lyco-close", {
          detail: { event },
          bubbles: true,
          composed: true,
        })
      );
    });

    header.append(title, close);
    body.append(message, content);
    panel.append(header, body, footer);
    stage.append(panel);
    wrapper.append(scrim, stage);
    root.append(style, wrapper);

    this.rootEl = wrapper;
    this.scrimEl = scrim;
    this.panelEl = panel;
    this.titleEl = title;
    this.messageEl = message;
    this.contentEl = content;
    this.footerEl = footer;
    this.closeButton = close;
  }

  connectedCallback(): void {
    if (!this.model) {
      this.setModel({
        title: this.getAttribute("title") ?? "",
        tone: (this.getAttribute("tone") as LycoTone | null) ?? "neutral",
        variant:
          (this.getAttribute("variant") as LycoDialogVariant | null) ??
          "dialog",
        placement:
          (this.getAttribute("placement") as LycoPlacement | null) ??
          "center",
      });
    }
  }

  attributeChangedCallback(): void {
    if (!this.isConnected || !this.model) return;
    this.patchModel({
      title: this.getAttribute("title") ?? this.model.title,
      tone: (this.getAttribute("tone") as LycoTone | null) ?? this.model.tone,
      variant:
        (this.getAttribute("variant") as LycoDialogVariant | null) ??
        this.model.variant,
      placement:
        (this.getAttribute("placement") as LycoPlacement | null) ??
        this.model.placement,
    });
  }

  setModel(model: LycoDialogRenderModel): void {
    this.model = model;

    const tone = toneAttr(model.tone);
    const variant = model.variant ?? "dialog";
    const placement = model.placement ?? "center";

    this.setAttribute("tone", tone);
    this.setAttribute("variant", variant);
    this.setAttribute("placement", placement);
    this.setAttribute("layout", model.layout ?? "default");
    this.setAttribute("body-padding", String(model.bodyPadding !== false));
    this.setAttribute("footer-padding", String(model.footerPadding !== false));

    this.panelEl.setAttribute("role", model.role ?? "dialog");
    this.panelEl.setAttribute(
      "aria-modal",
      model.scrim === false ? "false" : "true"
    );

    this.scrimEl.hidden = model.scrim === false;
    this.scrimEl.toggleAttribute("passive", model.pointerBlock === false);
    this.closeButton.hidden = !model.showClose;

    setOptionalContent(this.titleEl, model.title);
    setOptionalContent(this.messageEl, model.message);
    setOptionalContent(this.contentEl, model.content);
    renderActions(this.footerEl, model.actions);
  }

  patchModel(patch: Partial<LycoDialogRenderModel>): void {
    this.setModel({ ...(this.model ?? {}), ...patch });
  }

  focusPanel(options?: FocusOptions): boolean {
    this.panelEl.focus(options);
    return this.shadowRoot?.activeElement === this.panelEl;
  }

  focusFirstAction(options?: FocusOptions): boolean {
    const action = this.footerEl.querySelector<HTMLButtonElement>(
      "button:not(:disabled)"
    );
    if (!action) return false;
    action.focus(options);
    return this.shadowRoot?.activeElement === action;
  }

  getPanel(): HTMLElement {
    return this.panelEl;
  }
}

export function defineLycoDialogElement(): CustomElementConstructor {
  return defineCustomElement("lyco-dialog", LycoDialogElement);
}

declare global {
  interface HTMLElementTagNameMap {
    "lyco-dialog": LycoDialogElement;
  }
}
