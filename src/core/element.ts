import type {
  LycoAttrs,
  LycoPopupContent,
  LycoRenderContext,
  LycoStyleVars,
} from "../lyco-shortcuts-types";
import { applyAttrs } from "../dom/attrs";
import { resolveContent } from "../dom/content";
import { applyStyleVars } from "../style/style-vars";

export type ModelElement<TModel> = HTMLElement & {
  setModel?: (model: TModel) => void;
  patchModel?: (patch: Partial<TModel>) => void;
};

export function createElementFromInput(
  input: string | HTMLElement | undefined,
  fallbackTag: string
): HTMLElement {
  if (input instanceof HTMLElement) return input;
  return document.createElement(input ?? fallbackTag);
}

export function applyElementOptions(
  element: HTMLElement,
  options: {
    attrs?: LycoAttrs;
    styleVars?: LycoStyleVars;
    className?: string;
  }
): void {
  applyAttrs(element, options.attrs);
  applyStyleVars(element, options.styleVars);
  if (options.className) element.classList.add(...options.className.split(/\s+/).filter(Boolean));
}

export function setElementModel<TModel>(
  element: HTMLElement,
  model: TModel
): void {
  const target = element as ModelElement<TModel>;
  if (typeof target.setModel === "function") {
    target.setModel(model);
  } else {
    for (const [key, value] of Object.entries(model as Record<string, unknown>)) {
      if (
        value === null ||
        value === undefined ||
        typeof value === "object" ||
        typeof value === "function"
      ) {
        continue;
      }
      element.setAttribute(key, String(value));
    }
  }
}

export function patchElementModel<TModel>(
  element: HTMLElement,
  patch: Partial<TModel>
): void {
  const target = element as ModelElement<TModel>;
  if (typeof target.patchModel === "function") {
    target.patchModel(patch);
  } else {
    setElementModel(element, patch as TModel);
  }
}

export function resolveModelContent(
  content: LycoPopupContent,
  ctx: LycoRenderContext,
  onRenderError?: (error: unknown) => void
): string | number | Node | null | undefined {
  return resolveContent(content, ctx, (errorCtx) => {
    onRenderError?.(errorCtx.error);
  });
}
