import { useEffect, useRef, useState } from "react";
import { prepareStreamingChatTurn, type PreparedStreamingChatTurn, type PrepareStreamingChatTurnInput } from "../../lib/chatStreaming";

export function useChatPromptPreview(input: PrepareStreamingChatTurnInput, enabled: boolean) {
  const key = JSON.stringify(input);
  const currentKey = useRef(key);
  currentKey.current = key;
  const generation = useRef(0);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ key: string; data?: PreparedStreamingChatTurn; error?: string } | null>(null);
  useEffect(() => () => { generation.current++; }, []);
  const close = () => { generation.current++; setOpen(false); setState(null); };
  const prepare = async () => {
    if (!enabled) return;
    const id = ++generation.current;
    setOpen(true);
    setState(null);
    try {
      const data = await prepareStreamingChatTurn(structuredClone(input));
      if (generation.current === id && currentKey.current === key) setState({ key, data });
      else if (generation.current === id) setState({ key, error: "会话已变化，请关闭后重新预览。" });
    } catch (error) {
      if (generation.current === id) setState({ key, error: error instanceof Error ? error.message : "预览失败，请重试。" });
    }
  };
  const data = enabled && state?.key === key ? state.data : undefined;
  return { open, data, error: state && state.key !== key ? "会话已变化，请关闭后重新预览。" : state?.error,
    prepare, close };
}
