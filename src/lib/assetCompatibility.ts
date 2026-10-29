import { worldInfoExecutionNotes } from "./worldInfoDiagnostics";
import type { WorldInfoScanInputEntry } from "./worldInfoScan";

export type CompatibilityKind = "character" | "world" | "preset";
export type CompatibilityLevel = "full" | "partial" | "retained" | "not-executed";
export interface CompatibilityFinding { code: string; level: CompatibilityLevel; title: string; detail: string; paths: string[] }
export const compatibilityLabels: Record<CompatibilityLevel, string> = { full: "完整支持", partial: "部分支持", retained: "仅保留", "not-executed": "不执行" };
const markers = new Set(["charDescription", "charPersonality", "scenario", "dialogueExamples", "jailbreak", "personaDescription", "worldInfoBefore", "worldInfoAfter", "chatHistory"]);
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Read-only feature report, not a claim that an entire asset is fully executable. */
export function analyzeAssetCompatibility(kind: CompatibilityKind, payload: unknown): CompatibilityFinding[] {
  const root = record(payload);
  const findings: CompatibilityFinding[] = [];
  const add = (code: string, level: CompatibilityLevel, title: string, detail: string, paths: string[]) => findings.push({ code, level, title, detail, paths });
  const data = kind === "character" ? record(root.data) : root;
  add("io", "full", "原始格式与字段往返", "已支持格式的原始字段与未知扩展会保留；本报告不修改资产。字段能导出不代表其运行时行为已实现。", ["$"]);
  if (kind === "character") {
    add("character-text", "partial", "角色设定与问候", "支持基础设定、问候和备用问候；描述、性格、场景等是否发送取决于预设启用的 marker。V3 附加资源不自动加载。", ["data"]);
    if (data.system_prompt) add("character-system", "retained", "角色系统提示词", "system_prompt 保留；当前组装器不自动覆盖预设 main 提示词。", ["data.system_prompt"]);
  }
  const book = kind === "world" ? root : kind === "character" ? record(data.character_book) : {};
  if (book.entries) {
    add("world-basic", "full", "世界书基础扫描", "支持启用、常驻、文本包含关键词、大小写与扫描深度；按顺序分组。是否最终进入请求仍由预设 marker 决定。", [kind === "world" ? "entries" : "data.character_book.entries"]);
    const entries = Array.isArray(book.entries) ? book.entries : Object.values(record(book.entries));
    const notes = new Set<string>();
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      for (const note of worldInfoExecutionNotes(entry as WorldInfoScanInputEntry, { enabledFeatures: { timedEffects: true } })) notes.add(note);
    }
    if (notes.size) add("world-limits", "partial", "世界书当前执行限制", [...notes].join("；"), ["entries / character_book.entries"]);
  }
  if (kind === "preset") {
    const prompts = Array.isArray(root.prompts) ? root.prompts.map(record) : [];
    add("preset-order", "full", "提示词顺序与启用", "按 prompt_order 槽和 enabled 组装；默认槽 100001，缺失时回退非空槽。", ["prompts", "prompt_order"]);
    const unsupported = prompts.filter(p => p.marker === true && !markers.has(String(p.identifier)));
    if (unsupported.length) add("unknown-marker", "retained", "未实现的动态 marker", "这些 marker 目前不会生成内容：" + unsupported.map(p => String(p.identifier)).join("、"), unsupported.map(p => `prompts.${String(p.identifier)}`));
    if (prompts.some(p => ["injection_position", "injection_depth", "injection_order", "injection_trigger", "forbid_overrides"].some(k => p[k] !== undefined))) add("prompt-injection", "retained", "高级注入规则", "injection_* 与 forbid_overrides 保留，当前不参与深度、触发条件或覆盖控制；提示词仅按排序槽组装。", ["prompts.*.injection_*", "prompts.*.forbid_overrides"]);
    add("sampling", "partial", "采样与上下文", "请求映射 temperature、top_p、frequency_penalty、presence_penalty、openai_max_tokens；openai_max_context 用于启发式上下文预算，最旧历史可省略，必要内容超限会阻止发送。其他提供方参数仅保留。", ["$"]);
  }
  const scriptPaths: string[] = [], htmlPaths: string[] = [], extensionPaths: string[] = [], regexPaths: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (/<(?:!doctype|html|script|style|div|iframe)\b/i.test(value)) htmlPaths.push(path);
      if (/<script\b|\bon\w+\s*=|TavernHelper|JS-Slash-Runner|\bMVU\b|\bMvu\b|\bgetVariables\s*\(|\binjectScript\s*\(/i.test(value)) scriptPaths.push(path);
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else for (const [key, child] of Object.entries(record(value))) {
      const next = `${path}.${key}`;
      if (/tavern_helper|js.?slash.?runner|^mvu$/i.test(key)) scriptPaths.push(next);
      if (key === "extensions" && Object.keys(record(child)).length) extensionPaths.push(next);
      if (key === "regex_scripts") regexPaths.push(next);
      walk(child, next);
    }
  };
  walk(payload, "$");
  if (extensionPaths.length) add("extensions", "retained", "扩展数据", "未知扩展原样保留；除明确支持的读取路径外，不解释其运行时语义。", extensionPaths.slice(0, 8));
  if (regexPaths.length) add("regex", "partial", "内嵌正则", "仅支持现有 placement 与显示/提示词替换链路，不执行替换结果中的脚本；复杂 ST 扩展语义不保证一致。", regexPaths.slice(0, 8));
  if (htmlPaths.length) add("html", "partial", "HTML 静态显示", "安全净化后显示静态 HTML/CSS，阻止外部资源与脚本；只支持白名单声明式动作。动态生成的界面可能为空或只剩文本。", htmlPaths.slice(0, 8));
  if (scriptPaths.length) add("script-runtime", "not-executed", "脚本运行时依赖信号", "检测到 TavernHelper / MVU / JavaScript 等依赖信号。不会运行任意脚本；脚本生成的状态栏无法自动复现。原始内容仍保留，检测是启发式，不保证识别所有依赖。", [...new Set(scriptPaths)].slice(0, 8));
  return findings;
}
