import { create } from "zustand";
import { applyAppAppearance } from "../services/appAppearance";
import { loadAppSettings, patchAppSettings } from "../services/settingsStore";
import type { AppSettings } from "../types/settings";

type Appearance = Pick<AppSettings, "theme" | "fontScale">;
interface State extends Appearance {
  busy: boolean;
  error: string;
  refresh: () => Promise<void>;
  change: (patch: Partial<Appearance>) => Promise<void>;
}
let revision = 0;
export const useAppearanceStore = create<State>((set, get) => ({
  theme: "system", fontScale: "md", busy: false, error: "",
  refresh: async () => {
    const version = revision;
    try {
      const settings = await loadAppSettings();
      if (version !== revision) return;
      applyAppAppearance(settings);
      set({ theme: settings.theme, fontScale: settings.fontScale, error: "" });
    } catch { set({ error: "界面偏好读取失败，请重试。" }); }
  },
  change: async patch => {
    if (get().busy) return;
    revision++;
    set({ busy: true, error: "" });
    try {
      const settings = await patchAppSettings(patch);
      applyAppAppearance(settings);
      set({ theme: settings.theme, fontScale: settings.fontScale });
    } catch { set({ error: "界面偏好保存失败，已保留原设置，请重试。" }); }
    finally { set({ busy: false }); }
  },
}));
