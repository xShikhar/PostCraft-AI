import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Idiomatic React 19 hook to check if the component is mounted on the client.
 * Uses useSyncExternalStore to eliminate cascading re-renders and avoid hydration mismatch.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
