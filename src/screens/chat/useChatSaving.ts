import { useCallback, useEffect, useRef, useState } from "react";
import type { StoredChat } from "../../lib/db";
import type { ChatSaveCoordinator } from "../../services/chatSaveCoordinator";
import type { SaveChatSnapshotToDatabaseInput } from "../../services/chatPersistence";

interface ChatSavingInput {
  coordinator: ChatSaveCoordinator;
  snapshot: SaveChatSnapshotToDatabaseInput;
  dirty: boolean;
  paused: boolean;
  onSaved: (stored: StoredChat, latest: boolean) => void | Promise<void>;
  onError: (error: unknown) => void;
}

export function useChatSaving(input: ChatSavingInput) {
  const latest = useRef(input);
  latest.current = input;
  const mounted = useRef(true);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [failedSession, setFailedSession] = useState<object | null>(null);
  const session = input.coordinator.getSessionToken();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const save = useCallback((): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    const captured = latest.current;
    if (captured.paused) return Promise.resolve(false);
    const isCurrentSession = captured.coordinator.captureSession();
    const token = captured.coordinator.getSessionToken();
    setIsSaving(true);
    const operation = captured.coordinator.save(captured.snapshot).then(async result => {
      if (!mounted.current || !result.isCurrent()) return false;
      const unchanged = captured.snapshot === latest.current.snapshot;
      setFailedSession(null);
      await latest.current.onSaved(result.stored, unchanged);
      return unchanged;
    }).catch((error: unknown) => {
      if (mounted.current && isCurrentSession()) {
        setFailedSession(token);
        latest.current.onError(error);
      }
      return false;
    }).finally(() => {
      inFlight.current = null;
      if (mounted.current) setIsSaving(false);
    });
    inFlight.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    if (!input.dirty || input.paused || isSaving || failedSession === session) return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [input.dirty, input.paused, input.snapshot, isSaving, failedSession, session, save]);

  return { save, isSaving, saveFailed: failedSession === session };
}
