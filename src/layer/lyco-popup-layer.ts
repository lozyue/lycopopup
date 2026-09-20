import type {
  LycoLayerOrder,
  LycoLayerPositionStrategy,
  LycoPlacement,
  LycoPopupLayerOptions,
} from "../lyco-shortcuts-types";
import { defineCustomElement } from "../dom/define-element";
import { setBoolAttr } from "../dom/attrs";
import { applyStyleVars } from "../style/style-vars";
import { DEFAULT_LAYER_ORDER, DEFAULT_LAYER_PLACEMENT, toCssLength } from "../utils/pure";

const LAYER_STYLE = /*@plugin-css*/ `
  :host {
    position: fixed;
    inset: 0;
    z-index: var(--lyco-layer-z-index, 5000);
    box-sizing: border-box;
    pointer-events: none;
    font-family: var(--lyco-popup-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    color: var(--lyco-popup-fg, #111827);
  }

  :host([position-strategy="absolute"]) {
    position: absolute;
  }

  :host([hidden]) {
    display: none;
  }

  .viewport {
    min-width: 100%;
    min-height: 100%;
    box-sizing: border-box;
    display: flex;
    gap: var(--lyco-layer-gap, 12px);
    padding: var(--lyco-layer-padding, 16px);
  }

  :host([disabled]) .viewport {
    pointer-events: none;
  }

  ::slotted(*) {
    pointer-events: auto;
    box-sizing: border-box;
  }

  :host([placement="center"]) .viewport {
    align-items: center;
    justify-content: center;
  }

  :host([placement="top"]) .viewport,
  :host([placement="top-start"]) .viewport,
  :host([placement="top-end"]) .viewport {
    flex-direction: column;
    justify-content: flex-start;
  }

  :host([placement="bottom"]) .viewport,
  :host([placement="bottom-start"]) .viewport,
  :host([placement="bottom-end"]) .viewport {
    flex-direction: column;
    justify-content: flex-end;
  }

  :host([placement="top"]) .viewport,
  :host([placement="bottom"]) .viewport {
    align-items: center;
  }

  :host([placement="top-start"]) .viewport,
  :host([placement="bottom-start"]) .viewport {
    align-items: flex-start;
  }

  :host([placement="top-end"]) .viewport,
  :host([placement="bottom-end"]) .viewport {
    align-items: flex-end;
  }

  :host([placement="left"]) .viewport,
  :host([placement="left-start"]) .viewport,
  :host([placement="left-end"]) .viewport {
    flex-direction: row;
    justify-content: flex-start;
  }

  :host([placement="right"]) .viewport,
  :host([placement="right-start"]) .viewport,
  :host([placement="right-end"]) .viewport {
    flex-direction: row;
    justify-content: flex-end;
  }

  :host([placement="left"]) .viewport,
  :host([placement="right"]) .viewport {
    align-items: center;
  }

  :host([placement="left-start"]) .viewport,
  :host([placement="right-start"]) .viewport {
    align-items: flex-start;
  }

  :host([placement="left-end"]) .viewport,
  :host([placement="right-end"]) .viewport {
    align-items: flex-end;
  }
`;

export class LycoPopupLayerElement extends HTMLElement {
  viewport: HTMLDivElement;
  placement: LycoPlacement = DEFAULT_LAYER_PLACEMENT;
  order: LycoLayerOrder = DEFAULT_LAYER_ORDER;

  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    const viewport = document.createElement("div");
    const slot = document.createElement("slot");

    style.textContent = LAYER_STYLE;
    viewport.className = "viewport";
    viewport.part.add("viewport");
    viewport.appendChild(slot);
    root.append(style, viewport);

    this.viewport = viewport;
  }

  configure(options: LycoPopupLayerOptions): void {
    const placement = options.placement ?? DEFAULT_LAYER_PLACEMENT;
    const strategy: LycoLayerPositionStrategy = options.positionStrategy ?? "fixed";
    const order = options.order ?? DEFAULT_LAYER_ORDER;

    this.placement = placement;
    this.order = order;
    this.setAttribute("placement", placement);
    this.setAttribute("position-strategy", strategy);

    if (options.zIndex !== undefined) {
      this.style.setProperty("--lyco-layer-z-index", String(options.zIndex));
    }

    const gap = toCssLength(options.gap);
    if (gap) this.style.setProperty("--lyco-layer-gap", gap);

    if (options.padding) {
      this.style.setProperty("--lyco-layer-padding", options.padding);
    }

    if (options.className) this.className = options.className;
    applyStyleVars(this, options.styleVars);
  }

  setDisabled(disabled: boolean): void {
    setBoolAttr(this, "disabled", disabled);
  }
}

export function defineLycoPopupLayerElement(): CustomElementConstructor {
  return defineCustomElement("lyco-popup-layer", LycoPopupLayerElement);
}

declare global {
  interface HTMLElementTagNameMap {
    "lyco-popup-layer": LycoPopupLayerElement;
  }
}
