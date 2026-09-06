import { useEffect, useRef } from 'react';

interface UseVisibleRefreshOptions {
  /** Gates every timer and listener on the tab being open. */
  active: boolean;
  /** Auto-refresh cadence while the document is visible. */
  intervalMs: number;
  /** When true, run onRefresh once on entry (mount/activation) if visible. */
  immediateOnEntry?: boolean;
  /** Page-specific refresh action (API call, error mapping, tick bump). */
  onRefresh: () => void;
}

/**
 * Visible-tab refresh scheduler: runs onRefresh every intervalMs while the
 * document is visible and the tab is active. Panels stay mounted, so the
 * interval pauses in hidden tabs and on tab switches, and catches up once on
 * visibilitychange back to visible. Cleanup clears the interval and listener.
 *
 * The latest onRefresh is always invoked via a ref, so the interval is only
 * reset when active/intervalMs/immediateOnEntry change — never on unrelated
 * re-renders. Callers keep their own error handling and state bumps.
 */
export function useVisibleRefresh({ active, intervalMs, immediateOnEntry = false, onRefresh }: UseVisibleRefreshOptions): void {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!active) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const tick = (): void => {
      refreshRef.current();
    };
    const start = (): void => {
      if (intervalId === undefined) intervalId = setInterval(tick, intervalMs);
    };
    const stop = (): void => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        start();
        tick(); // catch up once right when the tab becomes visible again
      } else {
        stop();
      }
    };
    if (!document.hidden) {
      start();
      if (immediateOnEntry) tick(); // entry tick on mount/activation
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [active, intervalMs, immediateOnEntry]);
}
