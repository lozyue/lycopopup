import type {
  LycoCloseReason,
  LycoLayerOrder,
  LycoPopupController,
  LycoPopupLayerController,
  LycoPopupLayerOptions,
} from "../lyco-shortcuts-types";
import type { InternalPopupController } from "../core/controller";
import { defineLycoPopupLayerElement, LycoPopupLayerElement } from "./lyco-popup-layer";
import { DEFAULT_LAYER_ORDER, DEFAULT_LAYER_PLACEMENT, mergeDefined } from "../utils/pure";

export interface LycoLayerControllerInternal extends LycoPopupLayerController {
  readonly options: Required<Pick<LycoPopupLayerOptions, "placement" | "positionStrategy" | "order">> &
    Omit<LycoPopupLayerOptions, "placement" | "positionStrategy" | "order">;
  mount(): void;
  mountItem(controller: InternalPopupController, order?: LycoLayerOrder): void;
  unmountItem(controller: LycoPopupController): void;
}

function resolveMountTarget(target?: HTMLElement | ShadowRoot): HTMLElement | ShadowRoot {
  if (target) return target;
  if (typeof document === "undefined") {
    throw new Error("LycoPopup requires a DOM environment.");
  }
  return document.body;
}

export function isLayerController(
  value: unknown
): value is LycoPopupLayerController {
  return (
    typeof value === "object" &&
    value !== null &&
    "element" in value &&
    "closeAll" in value &&
    "getItems" in value
  );
}

export function createLycoPopupLayer(
  options: LycoPopupLayerOptions = {}
): LycoPopupLayerController {
  defineLycoPopupLayerElement();

  const normalized = mergeDefined<LycoPopupLayerOptions>(
    {
      placement: DEFAULT_LAYER_PLACEMENT,
      positionStrategy: "fixed",
      order: DEFAULT_LAYER_ORDER,
    },
    options
  ) as LycoLayerControllerInternal["options"];

  const element = document.createElement(
    "lyco-popup-layer"
  ) as LycoPopupLayerElement;
  const mountTo = resolveMountTarget(options.mountTo);
  const items: InternalPopupController[] = [];

  element.configure(normalized);

  let destroyed = false;

  const mount = () => {
    if (destroyed || element.isConnected) return;
    mountTo.appendChild(element);
  };

  const removeFromItems = (controller: LycoPopupController) => {
    const index = items.indexOf(controller as InternalPopupController);
    if (index >= 0) items.splice(index, 1);
  };

  const controller: LycoLayerControllerInternal = {
    element,
    options: normalized,

    mount,

    mountItem(item, order = normalized.order) {
      if (destroyed) return;
      mount();

      if (order === "newest-first") {
        element.insertBefore(item.element, element.firstElementChild);
        items.unshift(item);
      } else {
        element.appendChild(item.element);
        items.push(item);
      }
    },

    unmountItem(item) {
      removeFromItems(item);
      item.element.remove();
    },

    async closeAll(reason: LycoCloseReason = "programmatic") {
      await Promise.all([...items].map((item) => item.close(reason)));
    },

    hideAll() {
      element.hidden = true;
    },

    showAll() {
      element.hidden = false;
    },

    getItems() {
      return [...items];
    },

    getKeys() {
      return items
        .map((item) => item.key)
        .filter((key): key is string => typeof key === "string");
    },

    hasKey(key: string) {
      return items.some((item) => item.key === key);
    },

    setDisabled(disabled: boolean) {
      element.setDisabled(disabled);
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      void Promise.all([...items].map((item) => item.close("destroyed"))).finally(
        () => {
          items.splice(0);
          element.remove();
        }
      );
    },
  };

  return controller;
}

export function toInternalLayerController(
  layer: LycoPopupLayerController
): LycoLayerControllerInternal {
  return layer as LycoLayerControllerInternal;
}
