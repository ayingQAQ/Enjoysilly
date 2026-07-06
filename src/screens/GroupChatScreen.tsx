import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2, Send, Square, Users } from "lucide-react";

import { loadCharacterDetailSummary, type CharacterDetailSummary } from "../services/characterDetails";
import { loadPresetDetailSummary, type PresetDetailSummary } from "../services/presetDetails";
import { loadGroupAssetSummaries, loadGroupDetail, type GroupAssetSummary, type GroupDetail } from "../services/groupCatalog";
import {
  loadPresetAssetSummaries,
  type PresetAssetSummary,
} from "../services/assetCatalog";
import { saveChatSnapshotToDatabase } from "../services/chatPersistence";
import { loadAppSettings, loadUserPersonas, selectDefaultPersona } from "../services/settingsStore";
import { getWorldInfo } from "../lib/db";
import type { WorldInfoScanInputEntry } from "../lib/worldInfoScan";
import { resolveDefaultWorldInfoEntries } from "./chatScreenHelpers";
import { extractRegexScripts } from "../lib/presetIO";
import { normalizeGroupMembers, resolveNextGroupSpeaker } from "../lib/groupSpeaker";
import { runStreamingChatTurn } from "../lib/chatStreaming";
import { getChatMessageDisplayText } from "../lib/chatHistory";
import { estimateChatMessagesTokens } from "../lib/tokenEstimate";
import {
  createMinimalChatPreset,
  createGreetingChatMessage,
  defaultBaseUrl,
  defaultModel,
  defaultUserName,
  isAbortError,
  normalizeName,
} from "./chatScreenHelpers";
import { ChatBubble, EmptyChatState, Field, PanelTitle } from "./ChatScreenPanels";
import type { ChatMessageLine } from "../types/chat";
import type { GroupConfig } from "../types/group";

export function GroupChatScreen({ onBack }: { onBack?: () => void } = {}) {
  const [groups, setGroups] = useState<GroupAssetSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [presets, setPresets] = useState<PresetAssetSummary[]>([]);
  const [characterDetails, setCharacterDetails] = useState<Map<string, CharacterDetailSummary>>(new Map());
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetDetail, setPresetDetail] = useState<PresetDetailSummary | null>(null);
  const [speakerId, setSpeakerId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessageLine[]>([]);
  const [inputText, setInputText] = useState("");
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [userName, setUserName] = useState(defaultUserName);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState("等待输入");
  const [error, setError] = useState<string | null>(null);
  const [lastSpeakerId, setLastSpeakerId] = useState<string | undefined>();
  const [worldInfoEntries, setWorldInfoEntries] = useState<WorldInfoScanInputEntry[] | undefined>(
    undefined,
  );
  const abortRef = useRef<AbortController | null>(null);

  const fallbackPreset = useMemo(() => createMinimalChatPreset(), []);
  const activePreset = presetDetail?.stored.payload ?? fallbackPreset;
  const activeRegexScripts = useMemo(() => extractRegexScripts(activePreset), [activePreset]);
  const groupMembers = useMemo(
    () => normalizeGroupMembers(groupDetail?.stored.payload.members ?? []),
    [groupDetail],
  );
  const groupPromptMembers = useMemo(
    () => groupMembers.map((member) => ({
      characterId: member.characterId,
      name: member.displayName ?? member.characterId,
    })),
    [groupMembers],
  );
  const memberNames = useMemo(
    () => groupPromptMembers.map((member) => member.name),
    [groupPromptMembers],
  );

  useEffect(() => {
    loadGroupAssetSummaries().then(setGroups).catch(() => {});
    loadPresetAssetSummaries().then(setPresets).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedGroupId) return;
    loadGroupDetail(selectedGroupId).then((d) => {
      if (d) {
        setGroupDetail(d);
        setSpeakerId(resolveNextGroupSpeaker(d.stored.payload, lastSpeakerId) ?? "");
      }
    }).catch(() => {});
  }, [selectedGroupId]);

  useEffect(() => {
    if (!speakerId) {
      setPresetDetail(null);
      return;
    }
    const existing = characterDetails.get(speakerId);
    if (existing) return;
    let active = true;
    loadCharacterDetailSummary(speakerId)
      .then((d) => { if (active) setCharacterDetails((prev) => new Map(prev).set(speakerId, d)); })
      .catch(() => {});
    return () => { active = false; };
  }, [speakerId]);

  useEffect(() => {
    if (!selectedPresetId) { setPresetDetail(null); return; }
    let active = true;
    loadPresetDetailSummary(selectedPresetId)
      .then((d) => { if (active) setPresetDetail(d); })
      .catch(() => {});
    return () => { active = false; };
  }, [selectedPresetId]);

  useEffect(() => {
    let active = true;
    Promise.all([loadAppSettings(), loadUserPersonas()])
      .then(async ([settings, personas]) => {
        if (!active) return;
        const persona = selectDefaultPersona(personas);
        setBaseUrl(settings.api.baseUrl);
        setModel(settings.api.model);
        if (settings.api.apiKey) setApiKey(settings.api.apiKey);
        setUserName(persona.name);
        if (settings.defaultPresetId && !selectedPresetId) {
          setSelectedPresetId(settings.defaultPresetId);
        }
        if (settings.defaultWorldId) {
          try {
            const world = await getWorldInfo(settings.defaultWorldId);
            if (active) {
              setWorldInfoEntries(
                resolveDefaultWorldInfoEntries(settings.defaultWorldId, world ?? null),
              );
            }
          } catch {
            if (active) setWorldInfoEntries(undefined);
          }
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const speakerDetail = characterDetails.get(speakerId);
  const speakerCard = speakerDetail?.stored.payload;
  const canSend = !isStreaming && inputText.trim().length > 0 && speakerCard !== undefined && speakerId;

  const handleSpeakerChange = useCallback((nextId: string) => {
    setSpeakerId(nextId);
  }, []);

  const handleAddGreeting = useCallback(() => {
    if (!speakerCard) return;
    const greeting = createGreetingChatMessage({
      character: speakerCard,
      preferGroupOnly: true,
      userName: normalizeName(userName, defaultUserName),
    });

    if (!greeting) {
      setError("当前发言者没有可用的群聊问候或普通问候。");
      return;
    }

    setError(null);
    setMessages((currentMessages) => [...currentMessages, greeting]);
    setStatusText("已插入问候");
  }, [speakerCard, userName]);

  const handleSend = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userText = inputText.trim();
    if (!userText || isStreaming || !speakerCard) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setStatusText("正在请求模型");
    setError(null);
    setInputText("");

    try {
      for await (const update of runStreamingChatTurn({
        baseUrl: baseUrl.trim(),
        apiKey,
        model: model.trim(),
        preset: activePreset,
        character: speakerCard,
        messages,
        userName: normalizeName(userName, defaultUserName),
        userText,
        groupMembers: groupPromptMembers,
        groupName: groupDetail?.summary.name,
        speakerCharacterId: speakerId,
        signal: controller.signal,
        regexScripts: activeRegexScripts,
        worldInfoEntries,
      })) {
        setMessages(update.messages);
        if (update.kind === "started") setStatusText("已连接，等待首个 token");
        else if (update.kind === "delta") setStatusText("正在接收");
        else setStatusText(update.finishReason ? `完成：${update.finishReason}` : "完成");
      }
      setLastSpeakerId(speakerId);
      if (groupDetail) {
        const nextId = resolveNextGroupSpeaker(groupDetail.stored.payload, speakerId);
        if (nextId) setSpeakerId(nextId);
      }
    } catch (err: unknown) {
      if (isAbortError(err)) { setStatusText("已停止"); return; }
      setError(err instanceof Error ? err.message : String(err));
      setStatusText("失败");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsStreaming(false);
    }
  }, [inputText, isStreaming, speakerCard, speakerId, baseUrl, apiKey, model, activePreset, messages, userName, groupPromptMembers, groupDetail, activeRegexScripts]);

  const handleSave = useCallback(async () => {
    if (messages.length === 0) return;
    try {
      const charName = speakerCard?.data.name ?? "群聊";
      await saveChatSnapshotToDatabase({
        messages,
        userName: normalizeName(userName, defaultUserName),
        characterName: charName,
        groupId: selectedGroupId || undefined,
      });
      setStatusText("已保存");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [messages, userName, speakerCard, selectedGroupId]);

  const tokenCount = useMemo(() => estimateChatMessagesTokens(messages), [messages]);

  return (
    <section className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">群聊</p>
            <h1 className="text-2xl font-semibold">群组对话</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {groupDetail ? `${groupDetail.summary.name} · ${memberNames.join("、")}` : "请选择群组"}
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            {onBack ? (
              <button
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium"
                type="button"
                onClick={onBack}
              >
                返回管理
              </button>
            ) : null}
            <select
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              <option value="">选择群组</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid min-h-[640px] gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold">群聊窗口</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {speakerCard ? `当前发言者：${speakerCard.data.name}` : "未选择发言者"} · 约 {tokenCount} token
                </p>
              </div>
            </div>
            <button
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium"
              type="button"
              onClick={handleAddGreeting}
              disabled={!speakerCard || isStreaming}
            >
              插入问候
            </button>
            <button
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium"
              type="button"
              onClick={() => void handleSave()}
              disabled={messages.length === 0}
            >
              保存
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            {messages.length === 0 ? <EmptyChatState /> : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={`${msg.name}-${i}`} className={msg.is_user ? "flex justify-end" : "flex justify-start"}>
                    <div className={`max-w-[88%] rounded-lg px-4 py-3 ${msg.is_user ? "bg-[var(--accent)] text-white" : "border border-[var(--border-soft)] bg-[var(--surface-muted)]"}`}>
                      <p className="mb-1 text-xs opacity-80">{msg.name}</p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-7">{getChatMessageDisplayText(msg)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? <p className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <form className="border-t border-[var(--border-soft)] p-4" onSubmit={(event) => void handleSend(event)}>
            <textarea
              className="min-h-24 w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-3 text-sm outline-none focus:border-[var(--accent)]"
              disabled={isStreaming}
              placeholder="输入消息..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-[var(--text-muted)]">{statusText}</p>
              <div className="flex gap-2">
                {isStreaming ? (
                  <button className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700" type="button" onClick={() => abortRef.current?.abort()}>
                    <Square size={15} /> 停止
                  </button>
                ) : null}
                <button className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60" disabled={!canSend} type="submit">
                  <Send size={16} /> 发送
                </button>
              </div>
            </div>
          </form>
        </div>

        <aside className="flex flex-col gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4">
          <PanelTitle icon={<Users size={17} />} title="群组配置" subtitle="选择群组与发言者" />
          <Field label="API Base URL" value={baseUrl} onChange={setBaseUrl} />
          <Field label="API Key" type="password" value={apiKey} onChange={setApiKey} />
          <Field label="模型" value={model} onChange={setModel} />
          <Field label="用户名" value={userName} onChange={setUserName} />

          <div className="border-t border-[var(--border-soft)] pt-4">
            <p className="text-sm font-medium">发言者</p>
            <div className="mt-2 space-y-1">
              {groupMembers.map((m) => (
                <button
                  key={m.characterId}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${m.characterId === speakerId ? "border-[var(--accent)] bg-[var(--accent-weak)]" : "border-[var(--border-soft)] bg-[var(--surface-muted)]"}`}
                  type="button"
                  disabled={!m.enabled}
                  onClick={() => handleSpeakerChange(m.characterId)}
                >
                  {m.displayName || m.characterId}
                  {!m.enabled ? " (已禁用)" : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border-soft)] pt-4">
            <p className="text-sm font-medium">预设</p>
            <select
              className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
            >
              <option value="">最小预设</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </aside>
      </div>
    </section>
  );
}
