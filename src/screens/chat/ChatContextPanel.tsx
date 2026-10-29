import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "../../components/Modal";

const query = "(min-width: 1280px)";
export function useChatContextLayout() {
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  const [open, setOpen] = useState(wide);
  useEffect(() => {
    const media = window.matchMedia(query);
    const change = () => { setWide(media.matches); setOpen(media.matches); };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return { wide, open, setOpen };
}

export function ChatContextPanel({ wide, onClose, children }: { wide: boolean; onClose: () => void; children: ReactNode }) {
  return wide ? children : <Modal drawer aria-label="会话上下文" onRequestClose={onClose}
    className="flex w-full flex-col bg-[var(--surface)]" style={{ maxWidth: "min(100vw,24rem)" }}>
    {children}
  </Modal>;
}
