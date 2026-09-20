let lockCount = 0;
let previousOverflow = "";
let previousPaddingRight = "";

export function lockDocumentScroll(): () => void {
  if (typeof document === "undefined") return () => undefined;

  const body = document.body;
  lockCount += 1;

  if (lockCount === 1) {
    previousOverflow = body.style.overflow;
    previousPaddingRight = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);

    if (lockCount === 0) {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    }
  };
}
