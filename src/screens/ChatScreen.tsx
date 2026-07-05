import { useCallback, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Bot, KeyRound, Loader2, MessageSquare, RotateCcw, Send, Square } from "lucide-react";

import { getChatMessageDisplayText } from "../lib/chatHistory";
import { runStreamingChatTurn } from "../lib/chatStreaming";
import type { ChatMessageLine } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultModel = "gpt-4.1-mini";
const defaultUserName = "User";
const defaultCharacterName = "my_silly 助手";
const defaultCharacterDescription =
  "你是 my_silly 的本地调试助手。回复应当清晰、简洁，并保持中文交流。";
const defaultPersonaDescription = "用户正在测试 my_silly 的 OpenAI 兼容实时对话链路。";

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessageLine[]>([]);
  const [inputText, setInputText] = useState("");
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [userName, setUserName] = useState(defaultUserName);
  const [characterName, setCharacterName] = useState(defaultCharacterName);
  const [characterDescription, setCharacterDescription] = useState(
    defaultCharacterDescription,
  );
  const [personaDescription, setPersonaDescription] = useState(
    defaultPersonaDescription,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState("等待输入");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const preset = useMemo(() => createMinimalChatPreset(), []);
  const character = useMemo(
    () =>
      createLocalChatCharacter({
        name: characterName,
        description: characterDescription,
      }),
    [characterDescription, characterName],
  );

  const handleSend = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const userText = inputText.trim();
      const trimmedBaseUrl = baseUrl.trim();
      const trimmedModel = model.trim();

      if (!userText || isStreaming) {
        return;
      }

      if (!trimmedBaseUrl) {
        setError("请先填写 OpenAI 兼容 API Base URL。");
        return;
      }

      if (!trimmedModel) {
        setError("请先填写模型名称。");
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      setStatusText("正在请求模型");
      setError(null);
      setInputText("");

      try {
        for await (const update of runStreamingChatTurn({
          baseUrl: trimmedBaseUrl,
          apiKey,
          model: trimmedModel,
          preset,
          character,
          messages,
          userName: normalizeName(userName, defaultUserName),
          userText,
          personaDescription,
          signal: controller.signal,
        })) {
          setMessages(update.messages);

          if (update.kind === "started") {
            setStatusText("模型已连接，等待首个 token");
          } else if (update.kind === "delta") {
            setStatusText("正在流式接收");
          } else {
            setStatusText(
              update.finishReason
                ? `完成：${update.finishReason}`
                : "回复完成",
            );
          }
        }
      } catch (sendError: unknown) {
        if (isAbortError(sendError)) {
          setStatusText("已停止生成");
          return;
        }

        setError(formatChatSendError(sendError));
        setStatusText("请求失败");
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsStreaming(false);
      }
    },
    [
      apiKey,
      baseUrl,
      character,
      inputText,
      isStreaming,
      messages,
      model,
      personaDescription,
      preset,
      userName,
    ],
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleReset = useCallback(() => {
    if (isStreaming) {
      return;
    }

    setMessages([]);
    setError(null);
    setStatusText("等待输入");
  }, [isStreaming]);

  return (
    <section className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">
              实时对话
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              连接 OpenAI 兼容接口，执行最小流式 Chat Completion 回合。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              当前页面只做本地会话调试：使用阶段 4 纯 service 组装请求、接收
              SSE 流并显示消息，不保存 IndexedDB，不修改角色卡、世界书或预设
              payload。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <SummaryTile label="消息行" value={messages.length} />
            <SummaryTile
              label="模型"
              value={model.trim() || "未设置"}
              compact
            />
            <SummaryTile label="状态" value={statusText} compact />
          </div>
        </div>
      </div>

      <div className="grid min-h-[640px] gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 flex-col rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                <MessageSquare size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">本地对话窗口</h2>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {normalizeName(characterName, defaultCharacterName)} ·{" "}
                  {normalizeName(userName, defaultUserName)}
                </p>
              </div>
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isStreaming || messages.length === 0}
              type="button"
              onClick={handleReset}
            >
              <RotateCcw size={14} />
              清空
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            {messages.length === 0 ? (
              <EmptyChatState />
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <ChatBubble key={`${message.name}-${index}`} message={message} />
                ))}
              </div>
            )}
          </div>

          {error ? (
            <p className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
              {error}
            </p>
          ) : null}

          <form
            className="border-t border-[var(--border-soft)] p-4"
            onSubmit={(event) => void handleSend(event)}
          >
            <label className="sr-only" htmlFor="chat-message-input">
              输入消息
            </label>
            <textarea
              id="chat-message-input"
              className="min-h-24 w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              disabled={isStreaming}
              placeholder="输入要发送给模型的消息..."
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p aria-live="polite" className="text-xs text-[var(--text-muted)]">
                {statusText}
              </p>
              <div className="flex gap-2">
                {isStreaming ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:border-red-300"
                    type="button"
                    onClick={handleStop}
                  >
                    <Square size={15} />
                    停止
                  </button>
                ) : null}
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isStreaming || inputText.trim().length === 0}
                  type="submit"
                >
                  {isStreaming ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  发送
                </button>
              </div>
            </div>
          </form>
        </div>

        <aside className="flex min-h-0 flex-col gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
          <PanelTitle
            icon={<KeyRound size={17} />}
            title="接口配置"
            subtitle="仅保存在当前页面状态，不写入本地数据库。"
          />
          <Field label="API Base URL" value={baseUrl} onChange={setBaseUrl} />
          <Field label="API Key" type="password" value={apiKey} onChange={setApiKey} />
          <Field label="模型" value={model} onChange={setModel} />

          <div className="border-t border-[var(--border-soft)] pt-4">
            <PanelTitle
              icon={<Bot size={17} />}
              title="调试角色"
              subtitle="用于生成本回合 prompt；后续阶段再接入真实角色/预设选择。"
            />
          </div>
          <Field label="用户名" value={userName} onChange={setUserName} />
          <Field
            label="角色名"
            value={characterName}
            onChange={setCharacterName}
          />
          <TextAreaField
            label="角色描述"
            value={characterDescription}
            onChange={setCharacterDescription}
          />
          <TextAreaField
            label="用户 persona"
            value={personaDescription}
            onChange={setPersonaDescription}
          />

          <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]">
            内置预设包含 system、personaDescription、charDescription、
            chatHistory 四个原生 prompt 项；不会执行 TavernHelper、
            JS-Slash-Runner 或正则脚本。
          </div>
        </aside>
      </div>
    </section>
  );
}

export function createLocalChatCharacter(input: {
  name?: string;
  description?: string;
}): CharacterCard {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: normalizeName(input.name, defaultCharacterName),
      description: input.description?.trim() || defaultCharacterDescription,
      first_mes: "",
      extensions: {},
    },
  };
}

export function createMinimalChatPreset(): ChatCompletionPreset {
  return {
    temperature: 0.7,
    top_p: 1,
    openai_max_tokens: 800,
    stream_openai: true,
    prompts: [
      {
        identifier: "main",
        name: "主系统提示",
        role: "system",
        content:
          "你正在扮演 {{char}}，与 {{user}} 进行自然对话。回复应清晰、具体，并遵守角色描述。",
        enabled: true,
      },
      {
        identifier: "personaDescription",
        name: "用户 persona",
        role: "system",
        marker: true,
        enabled: true,
      },
      {
        identifier: "charDescription",
        name: "角色描述",
        role: "system",
        marker: true,
        enabled: true,
      },
      {
        identifier: "chatHistory",
        name: "聊天记录",
        role: "user",
        marker: true,
        enabled: true,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "main", enabled: true },
          { identifier: "personaDescription", enabled: true },
          { identifier: "charDescription", enabled: true },
          { identifier: "chatHistory", enabled: true },
        ],
      },
    ],
  };
}

function ChatBubble({ message }: { message: ChatMessageLine }) {
  const isUser = message.is_user === true;
  const content = getChatMessageDisplayText(message);

  return (
    <article className={["flex", isUser ? "justify-end" : "justify-start"].join(" ")}>
      <div
        className={[
          "max-w-[88%] rounded-lg px-4 py-3 shadow-sm",
          isUser
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-primary)]",
        ].join(" ")}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs opacity-80">
          <span className="font-medium">{message.name}</span>
          {message.send_date ? <span>{message.send_date}</span> : null}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-7">
          {content || "正在生成..."}
        </p>
      </div>
    </article>
  );
}

function EmptyChatState() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center">
      <div>
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
          <MessageSquare size={22} />
        </div>
        <h2 className="text-base font-semibold">还没有消息</h2>
        <p className="mt-2 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
          填好接口与模型后发送第一条消息。页面会显示真实流式响应；如果浏览器被
          CORS 拦截，请换用允许 Web 调用的兼容端点。
        </p>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-muted)] px-3 py-2">
      <p
        className={[
          "truncate font-semibold",
          compact ? "text-sm" : "text-xl",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function PanelTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <div className="mt-0.5 text-[var(--accent-strong)]">{icon}</div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password";
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-[var(--text-primary)]">{label}</span>
      <input
        className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-[var(--text-primary)]">{label}</span>
      <textarea
        className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[var(--accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function normalizeName(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : fallback;
}

function formatChatSendError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}。请检查 API Base URL、模型名、API Key，以及端点是否允许浏览器 CORS 请求。`;
  }

  return `${String(error)}。请检查 API 配置。`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
