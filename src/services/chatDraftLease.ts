export interface ChatDraftLease {
  id: string;
  sourceId: string;
  release: () => void;
}

/** sessionStorage is copied by Duplicate Tab. A live lock prevents shared draft ownership. */
export async function acquireChatDraftLease(sourceId: string, locks: Pick<LockManager, "request"> | undefined): Promise<ChatDraftLease> {
  if (!locks) return { id: crypto.randomUUID(), sourceId, release: () => {} };
  let id = sourceId;
  for (;;) {
    const lease = await new Promise<ChatDraftLease | null>((resolve, reject) => {
      void locks.request(`enjoy-silly:draft:${id}`, { ifAvailable: true }, async lock => {
        if (!lock) { resolve(null); return; }
        let release!: () => void;
        const held = new Promise<void>(r => { release = r; });
        resolve({ id, sourceId, release });
        await held;
      }).catch(reject);
    });
    if (lease) return lease;
    id = crypto.randomUUID();
  }
}
