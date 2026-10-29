import { getChatMessageDisplayText } from "./chatHistory";
import type { ChatMessageLine } from "../types/chat";
import { scanWorldInfo, type WorldInfoScanInputEntry, type WorldInfoScanOptions, type WorldInfoScanRuntimeState } from "./worldInfoScan";

export function timedDurations(entry: WorldInfoScanInputEntry) {
  const data = "key" in entry ? entry : entry.extensions ?? {};
  const duration = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return { sticky: duration(data.sticky), cooldown: duration(data.cooldown), delay: duration(data.delay) };
}

/** Reconstruct clocks from current visible history. No imported payload or persistent clock is changed. */
export function replayTimedWorldInfo(entries: WorldInfoScanInputEntry[], messages: ChatMessageLine[], options: WorldInfoScanOptions) {
  const visible = messages.filter(m => !m.is_system && getChatMessageDisplayText(m).trim());
  const texts = visible.map(getChatMessageDisplayText);
  const enabledFeatures = { ...options.enabledFeatures, timedEffects: options.enabledFeatures?.timedEffects !== false };
  const hasTimed = entries.some(e => Object.values(timedDurations(e)).some(Boolean));
  if (!hasTimed || !enabledFeatures.timedEffects) return scanWorldInfo(entries, texts, { ...options, enabledFeatures });
  let lastUser = -1;
  visible.forEach((message, index) => { if (message.is_user) lastUser = index; });
  let state: WorldInfoScanRuntimeState = { timedByEntryId: {} };
  for (let index = 0; index < lastUser; index++) {
    if (!visible[index].is_user) continue;
    const result = scanWorldInfo(entries, texts.slice(0, index + 1), {
      ...options, diagnostics: false, enabledFeatures, runtimeState: { ...state, turnIndex: index },
    });
    state = result.runtimeState ?? state;
  }
  const boundaryTexts = lastUser >= 0 ? texts.slice(0, lastUser + 1) : texts;
  return scanWorldInfo(entries, boundaryTexts, { ...options, enabledFeatures, runtimeState: { ...state, turnIndex: Math.max(0, lastUser) } });
}
