import type { ChatCompletionPreset, PresetPrompt } from "../types/preset";

function assertNewId(preset: ChatCompletionPreset, id: string) {
  if (!id.trim() || preset.prompts.some(p => p.identifier === id) || preset.prompt_order.some(s => s.order.some(i => i.identifier === id))) throw new Error("提示词标识不能为空或重复。");
}
function ensureSlots(preset: ChatCompletionPreset) {
  if (!preset.prompt_order.length) preset.prompt_order.push({ character_id: 100001,
    order: preset.prompts.map(p => ({ identifier: p.identifier, enabled: p.enabled !== false })) });
}
export function addPrompt(preset: ChatCompletionPreset, id = crypto.randomUUID()): ChatCompletionPreset {
  assertNewId(preset, id);
  const next = structuredClone(preset);
  ensureSlots(next);
  next.prompts.push({ identifier: id, name: "新提示词", role: "system", content: "", enabled: true });
  for (const slot of next.prompt_order) slot.order.push({ identifier: id, enabled: true });
  return next;
}
export function copyPrompt(preset: ChatCompletionPreset, sourceId: string, id = crypto.randomUUID()): ChatCompletionPreset {
  assertNewId(preset, id);
  const index = preset.prompts.findIndex(p => p.identifier === sourceId);
  if (index < 0) throw new Error("提示词不存在。");
  if (preset.prompts[index].marker) throw new Error("动态内容由固定标识生成，不能复制；请新增普通提示词。");
  const next = structuredClone(preset);
  ensureSlots(next);
  const copy: PresetPrompt = { ...structuredClone(next.prompts[index]), identifier: id, name: `${next.prompts[index].name || sourceId} 副本` };
  next.prompts.splice(index + 1, 0, copy);
  for (const slot of next.prompt_order) {
    const hasSource = slot.order.some(i => i.identifier === sourceId);
    slot.order = slot.order.flatMap(i => i.identifier === sourceId ? [i, { ...structuredClone(i), identifier: id }] : [i]);
    if (!hasSource) slot.order.push({ identifier: id, enabled: copy.enabled !== false });
  }
  return next;
}
export function deletePrompt(preset: ChatCompletionPreset, id: string): ChatCompletionPreset {
  const next = structuredClone(preset);
  next.prompts = next.prompts.filter(p => p.identifier !== id);
  for (const slot of next.prompt_order) slot.order = slot.order.filter(i => i.identifier !== id);
  return next;
}
export function setPromptEnabled(preset: ChatCompletionPreset, id: string, enabled: boolean): ChatCompletionPreset {
  const next = structuredClone(preset);
  const prompt = next.prompts.find(p => p.identifier === id);
  if (!prompt) throw new Error("提示词不存在。");
  prompt.enabled = enabled;
  for (const slot of next.prompt_order) for (const item of slot.order) if (item.identifier === id) item.enabled = enabled;
  return next;
}
export function movePromptOrder(preset: ChatCompletionPreset, slotIndex: number, index: number, delta: -1 | 1): ChatCompletionPreset {
  const next = structuredClone(preset);
  const list = next.prompt_order[slotIndex]?.order;
  if (list && index >= 0 && index < list.length && index + delta >= 0 && index + delta < list.length) [list[index], list[index + delta]] = [list[index + delta], list[index]];
  return next;
}
