import type { LycoPopupAction, LycoTone } from "../lyco-shortcuts-types";
import { sortActions } from "../utils/pure";

export interface ActionRenderResult<T extends LycoPopupAction = LycoPopupAction> {
  actions: T[];
  buttons: HTMLButtonElement[];
}

export function toneAttr(tone: LycoTone | undefined): LycoTone {
  return tone ?? "neutral";
}

export function createIconButton(label: string, part: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.part.add(part);
  button.setAttribute("aria-label", label);
  button.textContent = "x";
  return button;
}

export function renderActions<T extends LycoPopupAction>(
  target: HTMLElement,
  actions: readonly T[] | undefined,
  eventName = "lyco-action"
): ActionRenderResult<T> {
  target.replaceChildren();

  const sorted = sortActions(actions);
  const buttons: HTMLButtonElement[] = [];

  sorted.forEach((action, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.part.add("action");
    button.dataset.actionIndex = String(index);
    button.dataset.actionRole = action.role ?? "neutral";
    button.textContent = action.text;
    button.disabled = Boolean(action.disabled || action.loading);
    button.tabIndex = action.disabled ? -1 : action.tabIndex ?? 0;
    button.toggleAttribute("loading", Boolean(action.loading));
    if (action.autofocus) button.autofocus = true;
    if (action.id) button.dataset.actionId = action.id;

    button.addEventListener("click", (event) => {
      target.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { action, index, event },
          bubbles: true,
          composed: true,
        })
      );
    });

    target.appendChild(button);
    buttons.push(button);
  });

  target.toggleAttribute("empty", sorted.length === 0);
  return { actions: sorted, buttons };
}

export function setOptionalContent(
  target: HTMLElement,
  content: string | number | Node | null | undefined
): void {
  target.replaceChildren();

  if (content === null || content === undefined || content === "") {
    target.hidden = true;
    return;
  }

  target.hidden = false;
  if (typeof content === "string" || typeof content === "number") {
    target.textContent = String(content);
  } else {
    target.appendChild(content);
  }
}
