import type {
  LycoErrorContext,
  LycoPopupContent,
  LycoRenderContext,
} from "../lyco-shortcuts-types";

export function clearNode(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function appendText(target: Node, value: string | number): void {
  target.appendChild(document.createTextNode(String(value)));
}

export function resolveContent(
  content: LycoPopupContent,
  ctx: LycoRenderContext,
  onError?: (ctx: LycoErrorContext) => void
): string | number | Node | null | undefined {
  if (typeof content !== "function") return content;

  try {
    return content(ctx);
  } catch (error) {
    onError?.({ phase: "render", error });
    return null;
  }
}

export function renderContent(
  target: Node,
  content: string | number | Node | null | undefined
): void {
  clearNode(target);
  if (content == null) return;

  if (typeof content === "string" || typeof content === "number") {
    appendText(target, content);
    return;
  }

  target.appendChild(content);
}

export function renderPopupContent(
  target: Node,
  content: LycoPopupContent,
  ctx: LycoRenderContext,
  onError?: (ctx: LycoErrorContext) => void
): void {
  renderContent(target, resolveContent(content, ctx, onError));
}
