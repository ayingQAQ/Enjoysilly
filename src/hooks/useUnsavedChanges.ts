import { useCallback, useEffect, useId, useRef } from "react";
import { unsavedChanges, type UnsavedGuard } from "../services/unsavedChanges";

export function useUnsavedChanges(guard: UnsavedGuard) {
  const id = useId();
  const latest = useRef(guard);
  latest.current = guard;
  useEffect(() => unsavedChanges.register(id, () => latest.current), [id]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!latest.current.dirty && !latest.current.busy) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return useCallback(() => unsavedChanges.request(id), [id]);
}
