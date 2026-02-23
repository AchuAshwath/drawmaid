import { useEffect, useRef, useSyncExternalStore } from "react";

const MAX_PROGRESS = 91;
const HALF_LIFE_MS = 2000;
const UPDATE_INTERVAL_MS = 50;

export function useFakeGenerationProgress(isGenerating: boolean): number {
  const progressRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscribersRef = useRef(new Set<() => void>());

  const store = {
    getSnapshot: () => progressRef.current,
    getServerSnapshot: () => 0,
    subscribe: (callback: () => void) => {
      subscribersRef.current.add(callback);
      return () => subscribersRef.current.delete(callback);
    },
  };

  useEffect(() => {
    if (isGenerating) {
      startTimeRef.current = Date.now();
      progressRef.current = 0;

      const tick = () => {
        const elapsed = Date.now() - startTimeRef.current!;
        progressRef.current =
          MAX_PROGRESS * (elapsed / (elapsed + HALF_LIFE_MS));
        subscribersRef.current.forEach((cb) => cb());
      };

      tick();
      intervalRef.current = setInterval(tick, UPDATE_INTERVAL_MS);
    } else {
      progressRef.current = 0;
      subscribersRef.current.forEach((cb) => cb());
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isGenerating]);

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
