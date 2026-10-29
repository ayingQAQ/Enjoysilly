import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

type Props = Omit<ComponentPropsWithoutRef<"dialog">, "onCancel" | "open"> & {
  onRequestClose: () => void | Promise<void>;
  busy?: boolean;
  drawer?: boolean;
  returnFocus?: () => HTMLElement | null;
};

/** Native top-layer modality supplies focus containment and makes the page inert. */
export function Modal({ onRequestClose, busy = false, drawer = false, returnFocus, className = "", children, ...props }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const restore = useRef(returnFocus);
  restore.current = returnFocus;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      const target = restore.current?.() ?? (previous?.isConnected ? previous : null);
      target?.focus({ preventScroll: true });
    };
  }, []);
  return <dialog {...props} ref={ref} aria-modal="true" aria-busy={busy}
    className={`app-modal ${drawer ? "app-drawer" : ""} ${className}`}
    onCancel={event => { event.preventDefault(); if (!busy) void onRequestClose(); }}>
    {children}
  </dialog>;
}

/** Asset refresh replaces list nodes; resolve the new opener by record identity. */
export function assetFocusTarget(id: string, action: string): HTMLElement | null {
  const article = [...document.querySelectorAll<HTMLElement>("[data-asset-id]")].find(el => el.dataset.assetId === id);
  return [...article?.querySelectorAll<HTMLButtonElement>("button") ?? []].find(button => button.getAttribute("aria-label") === action || button.textContent?.trim() === action) ?? null;
}
