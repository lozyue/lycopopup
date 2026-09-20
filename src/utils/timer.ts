export interface PausableTimer {
  readonly remaining: number;
  readonly active: boolean;
  pause(): void;
  resume(): void;
  restart(duration?: number): void;
  clear(): void;
}

export function createPausableTimer(
  callback: () => void,
  duration: number
): PausableTimer {
  let timerId = 0;
  let startedAt = 0;
  let left = Math.max(0, duration);
  let cleared = false;

  const clearTimer = () => {
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = 0;
    }
  };

  const start = () => {
    clearTimer();
    if (cleared || left <= 0) return;

    startedAt = Date.now();
    timerId = window.setTimeout(() => {
      timerId = 0;
      left = 0;
      callback();
    }, left);
  };

  start();

  return {
    get remaining() {
      if (!timerId) return left;
      return Math.max(0, left - (Date.now() - startedAt));
    },

    get active() {
      return timerId !== 0;
    },

    pause() {
      if (!timerId) return;
      left = Math.max(0, left - (Date.now() - startedAt));
      clearTimer();
    },

    resume() {
      if (timerId || cleared || left <= 0) return;
      start();
    },

    restart(nextDuration = duration) {
      cleared = false;
      left = Math.max(0, nextDuration);
      start();
    },

    clear() {
      cleared = true;
      clearTimer();
      left = 0;
    },
  };
}
