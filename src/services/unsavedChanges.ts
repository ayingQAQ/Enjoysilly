export interface UnsavedGuard {
  label: string;
  dirty: boolean;
  busy?: boolean;
  save: () => Promise<boolean>;
  discard?: () => void | Promise<void>;
}
interface LeavePrompt {
  labels: string[];
  busy: boolean;
  error?: string;
}

export class UnsavedChangesController {
  private guards = new Map<string, () => UnsavedGuard>();
  private listeners = new Set<() => void>();
  private prompt: LeavePrompt | null = null;
  private pending?: { ids: string[]; resolve: (value: boolean) => void };

  getSnapshot = () => this.prompt;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(prompt: LeavePrompt | null) {
    this.prompt = prompt;
    for (const listener of this.listeners) listener();
  }
  register(id: string, read: () => UnsavedGuard) {
    this.guards.set(id, read);
    return () => {
      if (this.guards.get(id) !== read) return;
      this.guards.delete(id);
      const pending = this.pending;
      if (pending && !this.prompt?.busy && pending.ids.every(key => !this.guards.has(key))) {
        this.pending = undefined;
        this.publish(null);
        pending.resolve(true);
      }
    };
  }
  request(onlyId?: string): Promise<boolean> {
    if (this.pending) return Promise.resolve(false);
    const ids = [...this.guards].filter(([id, read]) =>
      (!onlyId || id === onlyId) && (read().dirty || read().busy)).map(([id]) => id);
    if (!ids.length) return Promise.resolve(true);
    return new Promise(resolve => {
      this.pending = { ids, resolve };
      this.publish({ labels: ids.map(id => this.guards.get(id)!().label), busy: false });
    });
  }
  async requestGuard(guard: UnsavedGuard): Promise<boolean> {
    const id = crypto.randomUUID();
    const unregister = this.register(id, () => guard);
    try { return await this.request(id); }
    finally { unregister(); }
  }
  async choose(choice: "save" | "discard" | "cancel") {
    const pending = this.pending;
    if (!pending || this.prompt?.busy) return;
    if (choice === "cancel") {
      this.pending = undefined;
      this.publish(null);
      pending.resolve(false);
      return;
    }
    this.publish({ ...this.prompt!, busy: true, error: undefined });
    try {
      for (const id of pending.ids) {
        const guard = this.guards.get(id)?.();
        if (!guard) continue;
        if (guard.busy) throw new Error("正在生成、导入或保存，请等待完成后再离开。");
        if (!guard.dirty) continue;
        if (choice === "save" && !await guard.save()) {
          throw new Error("保存尚未成功，内容仍保留在当前页面。请检查错误后重试。");
        }
        if (choice === "discard") await guard.discard?.();
      }
      this.pending = undefined;
      this.publish(null);
      pending.resolve(true);
    } catch (error) {
      this.publish({ ...this.prompt!, busy: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export const unsavedChanges = new UnsavedChangesController();
