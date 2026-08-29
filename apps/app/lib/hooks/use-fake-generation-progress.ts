import { useEffect, useRef, useSyncExternalStore } from "react";

const MAX_PROGRESS = 91;
const HALF_LIFE_MS = 2000;
const UPDATE_INTERVAL_MS = 50;
const REFUSAL_PROGRESS = 18;
const REFUSAL_DECAY_HALF_LIFE_MS = 12000;
const REFUSAL_DECAY_DURATION_MS = 120000;
const REFUSAL_MIN_PROGRESS = 1;

export function useFakeGenerationProgress(
  isProgressing: boolean,
  isRefusal = false,
): number {
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
    if (isProgressing) {
      startTimeRef.current = Date.now();
      const startingProgress = progressRef.current;

      const tick = () => {
        const elapsed = Date.now() - startTimeRef.current!;
        progressRef.current =
          startingProgress +
          (MAX_PROGRESS - startingProgress) *
            (elapsed / (elapsed + HALF_LIFE_MS));
        subscribersRef.current.forEach((cb) => cb());
      };

      tick();
      intervalRef.current = setInterval(tick, UPDATE_INTERVAL_MS);
    } else if (isRefusal) {
      startTimeRef.current = Date.now();
      progressRef.current = REFUSAL_PROGRESS;

      const tick = () => {
        const elapsed = Date.now() - startTimeRef.current!;
        if (elapsed >= REFUSAL_DECAY_DURATION_MS) {
          progressRef.current = REFUSAL_MIN_PROGRESS;
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          subscribersRef.current.forEach((cb) => cb());
          return;
        }
        const decayedProgress =
          REFUSAL_PROGRESS *
          (REFUSAL_DECAY_HALF_LIFE_MS / (elapsed + REFUSAL_DECAY_HALF_LIFE_MS));
        progressRef.current = Math.max(REFUSAL_MIN_PROGRESS, decayedProgress);
        if (decayedProgress <= REFUSAL_MIN_PROGRESS) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
        }
        subscribersRef.current.forEach((cb) => cb());
      };

      tick();
      intervalRef.current = setInterval(tick, UPDATE_INTERVAL_MS);
    } else {
      startTimeRef.current = null;
      progressRef.current = 0;
      subscribersRef.current.forEach((cb) => cb());
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isProgressing, isRefusal]);

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
