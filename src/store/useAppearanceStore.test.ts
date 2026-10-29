// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { useAppearanceStore } from "./useAppearanceStore";
import * as settings from "../services/settingsStore";
import { resetDatabaseConnectionForTests } from "../lib/db";

afterEach(() => { vi.restoreAllMocks(); resetDatabaseConnectionForTests(); });
it("publishes committed appearance to every subscriber and keeps it on write failure", async () => {
  await settings.saveAppSettings({ ...settings.defaultAppSettings, theme: "light" });
  await useAppearanceStore.getState().refresh();
  const observed: string[] = [];
  const unsubscribe = useAppearanceStore.subscribe(state => observed.push(state.theme));
  try {
    await useAppearanceStore.getState().change({ theme: "dark" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(observed).toContain("dark");
    expect((await settings.loadAppSettings()).theme).toBe("dark");
    vi.spyOn(settings, "patchAppSettings").mockRejectedValue(new Error("quota"));
    await useAppearanceStore.getState().change({ theme: "light" });
    expect(useAppearanceStore.getState()).toMatchObject({ theme: "dark", busy: false });
    expect(useAppearanceStore.getState().error).toContain("失败");
    expect(document.documentElement.dataset.theme).toBe("dark");
  } finally { unsubscribe(); }
});
