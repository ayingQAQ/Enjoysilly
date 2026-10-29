import type { StoredChat } from "../lib/db";
import { saveChatSnapshotToDatabase, type SaveChatSnapshotToDatabaseInput } from "./chatPersistence";

/** One queue per mounted conversation workspace, with an identity independent of archive IDs. */
export class ChatSaveCoordinator {
  private session = { archiveId: undefined as string | undefined, revision: 0, updatedAt: null as string | null | undefined };
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly write = saveChatSnapshotToDatabase) {}

  beginSession(archiveId?: string, updatedAt?: string) {
    this.session = { archiveId, revision: 0, updatedAt: archiveId ? updatedAt : null };
  }

  captureSession() {
    const session = this.session;
    return () => this.session === session;
  }

  getSessionToken(): object {
    return this.session;
  }

  getArchiveVersion() { return this.session.updatedAt; }

  async flush(): Promise<void> {
    await this.tail;
  }

  save(input: SaveChatSnapshotToDatabaseInput): Promise<{
    stored: StoredChat;
    isCurrent: () => boolean;
  }> {
    const session = this.session;
    session.archiveId ??= input.id ?? crypto.randomUUID();
    const revision = ++session.revision;
    // IDB connections cannot be structured-cloned; the payload must be captured now.
    const { database, ...data } = input;
    const snapshot = { ...structuredClone(data), database, id: session.archiveId };
    const operation = this.tail.then(async () => {
      const stored = await this.write({ ...snapshot, expectedUpdatedAt: session.updatedAt });
      session.updatedAt = stored.updatedAt;
      return { stored, isCurrent: () => this.session === session && session.revision === revision };
    });
    // A failed write must not prevent a later explicit retry.
    this.tail = operation.catch(() => undefined);
    return operation;
  }
}
