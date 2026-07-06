import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  MessageSquare,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { loadCharacterAssetSummaries, type CharacterAssetSummary } from "../services/assetCatalog";
import {
  createGroup,
  loadGroupAssetSummaries,
  loadGroupDetail,
  removeGroup,
  type GroupAssetSummary,
  type GroupDetail,
} from "../services/groupCatalog";
import type { GroupMember } from "../types/group";
import { GroupChatScreen } from "./GroupChatScreen";

export function GroupsScreen() {
  const [groups, setGroups] = useState<GroupAssetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<GroupDetail | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<"manage" | "chat">("manage");

  const refresh = useCallback(async (shouldApply: () => boolean = () => true) => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await loadGroupAssetSummaries();
      if (shouldApply()) setGroups(list);
    } catch (err: unknown) {
      if (shouldApply()) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (shouldApply()) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refresh(() => active);
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!selectedGroupId) {
      setSelectedGroupDetail(null);
      return;
    }
    let active = true;
    loadGroupDetail(selectedGroupId)
      .then((d) => { if (active) setSelectedGroupDetail(d ?? null); })
      .catch(() => { if (active) setSelectedGroupDetail(null); });
    return () => { active = false; };
  }, [selectedGroupId]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm("确定删除此群组吗？角色卡和对话存档不会被删除。")) return;
    try {
      await removeGroup(id);
      if (selectedGroupId === id) setSelectedGroupId(null);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [refresh, selectedGroupId]);

  if (viewMode === "chat") {
    return <GroupChatScreen onBack={() => setViewMode("manage")} />;
  }

  return (
    <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">分组聊天</p>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
              创建由多个角色卡组成的群组，按发言顺序策略轮流对话。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              当前版本支持列表顺序、自然轮换和手动指定三种策略。群聊存档复用现有 chats store。
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={16} /> 创建群组
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--border-strong)]"
            type="button"
            onClick={() => setViewMode("chat")}
          >
            <MessageSquare size={16} /> 进入群聊
          </button>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="群组数" value={groups.length} />
        <SummaryTile label="总成员" value={groups.reduce((s, g) => s + g.memberCount, 0)} />
        <SummaryTile label="已启用" value={groups.reduce((s, g) => s + g.enabledMemberCount, 0)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">读取群组...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
            <Users size={22} />
          </div>
          <h2 className="text-lg font-semibold">还没有群组</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
            点击"创建群组"选择多个已导入角色卡组成群聊。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <article key={group.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                  <Users size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{group.name}</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {group.enabledMemberCount}/{group.memberCount} 人 · {strategyLabel(group.speakerStrategy)}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                {group.sampleMemberNames.map((name, i) => (
                  <div key={i} className="truncate rounded bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                    {name}
                  </div>
                ))}
                {group.memberCount > 3 ? (
                  <p className="px-2 text-xs text-[var(--text-muted)]">... 还有 {group.memberCount - 3} 位成员</p>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)]"
                  type="button"
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <Eye size={14} /> 查看详情
                </button>
                <button
                  className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 transition hover:border-red-300"
                  type="button"
                  onClick={() => void handleDelete(group.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedGroupDetail ? (
        <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">群组详情</p>
              <h2 className="mt-2 text-xl font-semibold">{selectedGroupDetail.summary.name}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {strategyLabel(selectedGroupDetail.stored.payload.speakerStrategy)} · {selectedGroupDetail.summary.enabledMemberCount} 人启用
              </p>
            </div>
            <button
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] transition hover:border-[var(--border-strong)]"
              type="button"
              onClick={() => setSelectedGroupId(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-2">
              {selectedGroupDetail.stored.payload.members.map((m, i) => (
                <div key={`${m.characterId}-${i}`} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {m.displayName || m.characterId}
                        {!m.enabled ? <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">已禁用</span> : null}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">#{m.order} · {m.characterId}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      ) : null}

      {showCreate ? (
        <CreateGroupDialog
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function CreateGroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [characters, setCharacters] = useState<CharacterAssetSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState<"listOrder" | "naturalRotation" | "manual">("listOrder");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const characterById = new Map(characters.map((character) => [character.id, character]));

  useEffect(() => {
    loadCharacterAssetSummaries()
      .then(setCharacters)
      .catch(() => setError("读取角色列表失败"));
  }, []);

  const toggleMember = useCallback((characterId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(characterId)) next.delete(characterId);
      else next.add(characterId);
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || selectedIds.size === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      const members: GroupMember[] = [...selectedIds].map((cid, i) => ({
        characterId: cid,
        displayName: characterById.get(cid)?.name,
        enabled: true,
        order: i,
      }));
      await createGroup(trimmed, members, { speakerStrategy: strategy });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [characterById, name, selectedIds, strategy, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">新建群组</p>
            <h2 className="mt-2 text-lg font-semibold">创建新群组</h2>
          </div>
          <button
            className="grid size-9 place-items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]"
            type="button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="font-medium">群名称</span>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入群名称"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium">发言策略</span>
            <select
              className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm outline-none"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as typeof strategy)}
            >
              <option value="listOrder">列表顺序</option>
              <option value="naturalRotation">自然轮换</option>
              <option value="manual">手动指定</option>
            </select>
          </label>

          <div>
            <p className="text-sm font-medium">选择成员</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              已选择 {selectedIds.size} 个角色
            </p>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {characters.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">还没有已导入角色卡。</p>
              ) : (
                characters.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleMember(c.id)}
                    />
                    {c.name}
                  </label>
                ))
              )}
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}

          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              取消
            </button>
            <button
              className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
              type="button"
              disabled={!name.trim() || selectedIds.size === 0 || isSaving}
              onClick={() => void handleCreate()}
            >
              {isSaving ? "创建中..." : "创建"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function strategyLabel(s: string): string {
  if (s === "listOrder") return "列表顺序";
  if (s === "naturalRotation") return "自然轮换";
  return "手动指定";
}
