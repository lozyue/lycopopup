import { defineLycoDialogElement } from "./dialog/lyco-dialog";
import { defineLycoNoticeElement } from "./notice/lyco-notice";
import { defineLycoPopupLayerElement } from "./layer/lyco-popup-layer";
import { defineLycoToastElement } from "./toast/lyco-toast";

export function defineLycoPopupElements(): void {
  defineLycoPopupLayerElement();
  defineLycoToastElement();
  defineLycoNoticeElement();
  defineLycoDialogElement();
}
