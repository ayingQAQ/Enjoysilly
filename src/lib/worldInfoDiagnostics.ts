import type { WorldInfoScanInputEntry, WorldInfoScanOptions } from "./worldInfoScan";

export type WorldInfoOutcome = "selected" | "disabled" | "empty" | "no-keyword" | "selective" | "probability" | "budget" | "recursion-only";
export interface WorldInfoAttempt {
  round: number;
  matchedKeys: string[];
  matchedSecondary: string[];
  reasons: Array<"constant" | "keyword">;
  outcome: WorldInfoOutcome;
  probabilityRoll?: number;
}
export interface WorldInfoDiagnostic {
  sourceIndex: number;
  id?: number;
  comment?: string;
  bucket: "before" | "after" | "atDepth";
  outcome: WorldInfoOutcome;
  attempts: WorldInfoAttempt[];
  notes: string[];
}
export const worldInfoOutcomeLabels: Record<WorldInfoOutcome, string> = {
  selected: "扫描选中", disabled: "已停用", empty: "内容为空", "no-keyword": "关键词未命中",
  selective: "次要关键词条件未满足", probability: "概率未通过", budget: "预算不足，已淘汰",
  "recursion-only": "等待递归轮，未被扫描",
};

export function worldInfoExecutionNotes(entry: WorldInfoScanInputEntry, options: WorldInfoScanOptions = {}): string[] {
  const ext: Record<string, unknown> = entry.extensions && typeof entry.extensions === "object" ? entry.extensions as Record<string, unknown> : {};
  const data: Record<string, unknown> = { ...ext, ...entry };
  const notes: string[] = [];
  if (data.selective && !options.enabledFeatures?.selective) notes.push("selective：当前未启用次要关键词判断");
  if (data.useProbability && !options.enabledFeatures?.probability) notes.push("probability：当前未启用概率门控");
  if (!options.enabledFeatures?.recursion) notes.push("recursion：当前未启用递归扫描");
  if (!options.enabledFeatures?.tokenBudget || options.tokenBudget === undefined || !options.estimateTokens) notes.push("tokenBudget：当前未应用世界书预算");
  for (const key of ["sticky", "cooldown", "delay", "group", "groupOverride", "groupWeight", "useGroupScoring", "vectorized", "matchWholeWords", "match_whole_words", "characterFilter", "automationId", "role"]) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== false && data[key] !== 0 && data[key] !== "") notes.push(`${key}：字段保留，当前未执行`);
  }
  if (typeof data.position === "number" && ![0, 1, 4].includes(data.position)) notes.push(`position=${data.position}：当前回退到角色前插入，不等同 ST 原位置`);
  if (!("key" in entry) && typeof ext.position === "number") notes.push("extensions.position：当前未按高级位置执行");
  return notes;
}
