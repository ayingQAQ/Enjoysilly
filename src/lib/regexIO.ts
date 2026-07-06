import type { RegexScript } from "../types/preset";

export interface ParsedRegexScriptFile {
  scripts: RegexScript[];
  warnings: string[];
}

export function parseRegexScriptsJson(json: string): ParsedRegexScriptFile {
  const parsed: unknown = JSON.parse(json);
  const warnings: string[] = [];

  const scripts = extractRegexScripts(parsed, warnings);

  return { scripts, warnings };
}

export function serializeRegexScriptsJson(scripts: RegexScript[]): string {
  const items = scripts.map((script) => {
    const item: Record<string, unknown> = {};
    const fields = [
      "id",
      "scriptName",
      "findRegex",
      "replaceString",
      "trimStrings",
      "placement",
      "disabled",
      "markdownOnly",
      "promptOnly",
      "runOnEdit",
      "substituteRegex",
      "minDepth",
      "maxDepth",
    ] as const;

    for (const field of fields) {
      const value = script[field];

      if (value !== undefined && value !== null) {
        item[field] = value;
      }
    }

    for (const [key, value] of Object.entries(script)) {
      if (!fields.includes(key as (typeof fields)[number]) && value !== undefined) {
        item[key] = value;
      }
    }

    return item;
  });

  return JSON.stringify(items.length === 1 ? items[0] : items, null, 2);
}

export function encodeRegexScriptsJson(scripts: RegexScript[]): Uint8Array {
  return new TextEncoder().encode(serializeRegexScriptsJson(scripts));
}

export function createRegexScriptFileName(script: RegexScript): string {
  const name = typeof script.scriptName === "string" && script.scriptName.trim().length > 0
    ? script.scriptName.trim()
    : "regex-script";

  const safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 80);

  return `${safe}.json`;
}

function extractRegexScripts(
  value: unknown,
  warnings: string[],
): RegexScript[] {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => toRegexScript(item, index, warnings))
      .filter((script): script is RegexScript => script !== null);
  }

  if (isRegexScriptShaped(value)) {
    const script = toRegexScript(value, 0, warnings);

    return script ? [script] : [];
  }

  throw new Error("JSON is not a valid regex script or script array.");
}

const knownRegexScriptFields = new Set([
  "id",
  "scriptName",
  "findRegex",
  "replaceString",
  "trimStrings",
  "placement",
  "disabled",
  "markdownOnly",
  "promptOnly",
  "runOnEdit",
  "substituteRegex",
  "minDepth",
  "maxDepth",
]);

function toRegexScript(
  value: unknown,
  index: number,
  warnings: string[],
): RegexScript | null {
  if (typeof value !== "object" || value === null) {
    warnings.push(`Regex script entry ${index} is not an object, skipping.`);
    return null;
  }

  const record = value as Record<string, unknown>;
  const scriptName = typeof record.scriptName === "string" && record.scriptName.trim().length > 0
    ? record.scriptName
    : `未命名正则 #${index + 1}`;

  const script: RegexScript = {
    scriptName,
    findRegex: typeof record.findRegex === "string" ? record.findRegex : "",
    replaceString: typeof record.replaceString === "string" ? record.replaceString : "",
  };

  if (typeof record.id === "string") {
    script.id = record.id;
  }
  script.trimStrings = Array.isArray(record.trimStrings)
    ? record.trimStrings.filter((v): v is string => typeof v === "string")
    : undefined;

  script.placement = Array.isArray(record.placement)
    ? record.placement.filter((v): v is number => typeof v === "number")
    : undefined;

  script.disabled = record.disabled === true;
  script.markdownOnly = record.markdownOnly === true;
  script.promptOnly = record.promptOnly === true;
  script.runOnEdit = record.runOnEdit === true;
  script.substituteRegex = typeof record.substituteRegex === "number" ? record.substituteRegex : undefined;
  script.minDepth = record.minDepth as number | null | undefined;
  script.maxDepth = record.maxDepth as number | null | undefined;

  for (const key of Object.keys(record)) {
    if (!knownRegexScriptFields.has(key)) {
      (script as Record<string, unknown>)[key] = record[key];
    }
  }

  return script;
}

function isRegexScriptShaped(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.findRegex === "string" ||
    typeof record.scriptName === "string" ||
    Array.isArray(record.placement)
  );
}
