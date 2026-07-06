import type { AppSettings } from "../types/settings";

export function applyAppAppearance(settings: Pick<AppSettings, "theme" | "fontScale">): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  if (settings.theme === "dark" || settings.theme === "light") {
    root.setAttribute("data-theme", settings.theme);
  } else {
    root.removeAttribute("data-theme");
  }

  root.setAttribute("data-font-scale", settings.fontScale);
}
