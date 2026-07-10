export interface RegexScriptLike {
  id?: string;
  scriptName?: string;
  findRegex?: string;
  replaceString?: string;
  trimStrings?: string[];
  placement?: number[];
  disabled?: boolean;
  markdownOnly?: boolean;
  promptOnly?: boolean;
  runOnEdit?: boolean;
  substituteRegex?: number;
  minDepth?: number | null;
  maxDepth?: number | null;
}

export interface RegexExecutionResult {
  text: string;
  applied: RegexScriptLike[];
  errors: RegexExecutionError[];
}

export interface RegexExecutionError {
  scriptIndex: number;
  scriptId: string | undefined;
  scriptName: string;
  error: string;
}

export interface ExecuteRegexScriptsOptions {
  placement?: number;
  promptOnly?: boolean;
  markdownOnly?: boolean;
}

export interface ExecuteRegexScriptsAsyncOptions extends ExecuteRegexScriptsOptions {
  timeoutMs?: number;
}

const matchPlaceholder = /\{\{match\}\}/g;

const defaultTimeoutMs = 5000;
const defaultPlainRegexFlags = "gm";

export function executeRegexScript(
  text: string,
  script: RegexScriptLike,
): { text: string; error?: string } {
  if (typeof script.findRegex !== "string" || typeof script.replaceString !== "string") {
    return { text };
  }

  if (script.findRegex.length === 0) {
    return { text };
  }

  let regex: RegExp;

  try {
    regex = createRegexFromFindRegex(script.findRegex);
  } catch (error: unknown) {
    return {
      text,
      error: `Invalid findRegex: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const replaceString = script.replaceString;

  try {
    const result = text.replace(regex, (...matchArgs) => {
      const fullMatch: string = matchArgs[0];
      const groups: string[] = matchArgs.slice(1, -2);

      let replaced = replaceString.replace(
        matchPlaceholder,
        fullMatch,
      );

      replaced = replaced.replace(
        /\$(\d+)/g,
        (_dollar, index: string) => {
          const groupIndex = Number(index);

          return groups[groupIndex - 1] ?? "";
        },
      );

      if (Array.isArray(script.trimStrings) && script.trimStrings.length > 0) {
        replaced = applyTrimStrings(replaced, script.trimStrings);
      }

      return replaced;
    });

    return { text: result };
  } catch (error: unknown) {
    return {
      text,
      error: `Regex execution failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function executeRegexScripts(
  text: string,
  scripts: RegexScriptLike[],
  options: ExecuteRegexScriptsOptions = {},
): RegexExecutionResult {
  const applied: RegexScriptLike[] = [];
  const errors: RegexExecutionError[] = [];
  let currentText = text;

  for (let index = 0; index < scripts.length; index += 1) {
    const script = scripts[index];

    if (!shouldRunScript(script, options)) {
      continue;
    }

    const scriptName =
      typeof script.scriptName === "string" && script.scriptName.length > 0
        ? script.scriptName
        : `未命名正则 #${index + 1}`;

    const scriptId =
      typeof script.id === "string" ? script.id : undefined;

    const result = executeRegexScript(currentText, script);

    if (result.error) {
      errors.push({
        scriptIndex: index,
        scriptId,
        scriptName,
        error: result.error,
      });
    }

    if (result.text !== currentText) {
      applied.push(script);
      currentText = result.text;
    }
  }

  return { text: currentText, applied, errors };
}

function applyTrimStrings(value: string, trimStrings: string[]): string {
  let result = value;

  for (const trim of trimStrings) {
    if (trim.length === 0) {
      continue;
    }

    while (isLineBreak(trim) ? startsWithStripped(result, trim) : result.startsWith(trim)) {
      result = result.slice(trim.length);
    }

    while (isLineBreak(trim) ? endsWithStripped(result, trim) : result.endsWith(trim)) {
      result = result.slice(0, result.length - trim.length);
    }
  }

  return result;
}

function shouldRunScript(
  script: RegexScriptLike,
  options: ExecuteRegexScriptsOptions,
): boolean {
  if (script.disabled === true) {
    return false;
  }

  if (
    options.placement !== undefined &&
    Array.isArray(script.placement) &&
    !script.placement.includes(options.placement)
  ) {
    return false;
  }

  if (
    options.promptOnly !== undefined &&
    (script.promptOnly === true) !== options.promptOnly
  ) {
    return false;
  }

  if (
    options.markdownOnly !== undefined &&
    (script.markdownOnly === true) !== options.markdownOnly
  ) {
    return false;
  }

  return true;
}

function createRegexFromFindRegex(findRegex: string): RegExp {
  const literal = parseRegexLiteral(findRegex);

  if (literal) {
    return new RegExp(literal.pattern, normalizeRegexFlags(literal.flags));
  }

  return new RegExp(findRegex, defaultPlainRegexFlags);
}

function parseRegexLiteral(
  value: string,
): { pattern: string; flags: string } | null {
  if (!value.startsWith("/")) {
    return null;
  }

  const lastSlashIndex = findLastUnescapedSlash(value);

  if (lastSlashIndex <= 0) {
    return null;
  }

  const flags = value.slice(lastSlashIndex + 1);

  if (!/^[dgimsuvy]*$/u.test(flags)) {
    return null;
  }

  return {
    pattern: value.slice(1, lastSlashIndex),
    flags,
  };
}

function findLastUnescapedSlash(value: string): number {
  for (let index = value.length - 1; index > 0; index -= 1) {
    if (value[index] !== "/") {
      continue;
    }

    let backslashCount = 0;

    for (
      let cursor = index - 1;
      cursor >= 0 && value[cursor] === "\\";
      cursor -= 1
    ) {
      backslashCount += 1;
    }

    if (backslashCount % 2 === 0) {
      return index;
    }
  }

  return -1;
}

function normalizeRegexFlags(flags: string): string {
  return [...new Set(flags)].join("");
}

function isLineBreak(value: string): boolean {
  return value === "\n" || value === "\r" || value === "\r\n";
}

function startsWithStripped(value: string, trim: string): boolean {
  const stripped = value.replace(/^[\r\n]+/, "");

  return stripped !== value || value.startsWith(trim);
}

function endsWithStripped(value: string, trim: string): boolean {
  const stripped = value.replace(/[\r\n]+$/, "");

  return stripped !== value || value.endsWith(trim);
}

function isWorkerSupported(): boolean {
  try {
    return typeof Worker !== "undefined" && typeof Blob !== "undefined";
  } catch {
    return false;
  }
}

export async function executeRegexScriptsAsync(
  text: string,
  scripts: RegexScriptLike[],
  options: ExecuteRegexScriptsAsyncOptions = {},
): Promise<RegexExecutionResult> {
  if (!isWorkerSupported() || scripts.length === 0) {
    return executeRegexScripts(text, scripts, options);
  }

  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const workerUrl = createRegexWorkerUrl();

  try {
    return await runWorkerWithTimeout(workerUrl, text, scripts, options, timeoutMs);
  } finally {
    URL.revokeObjectURL(workerUrl);
  }
}

function runWorkerWithTimeout(
  workerUrl: string,
  text: string,
  scripts: RegexScriptLike[],
  options: ExecuteRegexScriptsOptions,
  timeoutMs: number,
): Promise<RegexExecutionResult> {
  return new Promise((resolve) => {
    const worker = new Worker(workerUrl);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();

      resolve({
        text,
        applied: [],
        errors: [
          {
            scriptIndex: -1,
            scriptId: undefined,
            scriptName: "regex-worker",
            error: `Regex execution timed out after ${timeoutMs}ms`,
          },
        ],
      });
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();

      if (event.data?.ok === true && event.data?.result) {
        resolve(event.data.result as RegexExecutionResult);
      } else {
        resolve({
          text,
          applied: [],
          errors: [
            {
              scriptIndex: -1,
              scriptId: undefined,
              scriptName: "regex-worker",
              error: event.data?.error ?? "Unknown worker error",
            },
          ],
        });
      }
    };

    worker.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();

      resolve({
        text,
        applied: [],
        errors: [
          {
            scriptIndex: -1,
            scriptId: undefined,
            scriptName: "regex-worker",
            error: "Regex worker crashed",
          },
        ],
      });
    };

    worker.postMessage({ id: "1", text, scripts, options });
  });
}

function createRegexWorkerUrl(): string {
  const blob = new Blob([regexWorkerCode], { type: "application/javascript" });

  return URL.createObjectURL(blob);
}

const regexWorkerCode = `
"use strict";
var P = /\\{\\{match\\}\\}/g;
var L = /^\\/([\\s\\S]*)\\/([a-z]*)$/i;
function lastSlash(v) {
  for (var i = v.length - 1; i > 0; i--) {
    if (v[i] !== "/") continue;
    var n = 0;
    for (var c = i - 1; c >= 0 && v[c] === "\\\\"; c--) n++;
    if (n % 2 === 0) return i;
  }
  return -1;
}
function uniqFlags(f) {
  var seen = {};
  var out = "";
  for (var i = 0; i < f.length; i++) {
    if (!seen[f[i]]) { seen[f[i]] = true; out += f[i]; }
  }
  return out;
}
function makeRegex(v) {
  if (v.indexOf("/") === 0) {
    var li = lastSlash(v);
    if (li > 0) {
      var flags = v.slice(li + 1);
      if (/^[dgimsuvy]*$/i.test(flags)) return new RegExp(v.slice(1, li), uniqFlags(flags));
    }
  }
  return new RegExp(v, "gm");
}
function isLB(v) { return v === "\\n" || v === "\\r" || v === "\\r\\n"; }
function startsStripped(v, trim) {
  var stripped = v.replace(/^[\\r\\n]+/, "");
  return stripped !== v || v.startsWith(trim);
}
function endsStripped(v, trim) {
  var stripped = v.replace(/[\\r\\n]+$/, "");
  return stripped !== v || v.endsWith(trim);
}
function e(t, s) {
  if (typeof s.findRegex !== "string" || typeof s.replaceString !== "string") return { text: t };
  if (s.findRegex.length === 0) return { text: t };
  var r;
  try { r = makeRegex(s.findRegex); }
  catch (err) { return { text: t, error: "Invalid findRegex: " + (err instanceof Error ? err.message : String(err)) }; }
  try {
    var result = t.replace(r, function() {
      var m = arguments[0];
      var groups = Array.prototype.slice.call(arguments, 1, -2);
      var rep = s.replaceString.replace(P, m);
      rep = rep.replace(/\\$(\\d+)/g, function(_, idx) { var gi = Number(idx); return groups[gi - 1] || ""; });
      if (Array.isArray(s.trimStrings) && s.trimStrings.length > 0) {
        for (var i = 0; i < s.trimStrings.length; i++) {
          var trim = s.trimStrings[i];
          if (trim.length === 0) continue;
          while (isLB(trim) ? startsStripped(rep, trim) : rep.startsWith(trim)) rep = rep.slice(trim.length);
          while (isLB(trim) ? endsStripped(rep, trim) : rep.endsWith(trim)) rep = rep.slice(0, rep.length - trim.length);
        }
      }
      return rep;
    });
    return { text: result };
  } catch (err) { return { text: t, error: "Regex execution failed: " + (err instanceof Error ? err.message : String(err)) }; }
}
function x(t, s, o) {
  o = o || {};
  var applied = [], errors = [], cur = t;
  for (var i = 0; i < s.length; i++) {
    var script = s[i];
    if (script.disabled === true) continue;
    if (o.placement !== undefined && Array.isArray(script.placement) && !script.placement.includes(o.placement)) continue;
    if (o.promptOnly !== undefined && (script.promptOnly === true) !== o.promptOnly) continue;
    if (o.markdownOnly !== undefined && (script.markdownOnly === true) !== o.markdownOnly) continue;
    var name = typeof script.scriptName === "string" && script.scriptName.length > 0 ? script.scriptName : "regex #" + (i + 1);
    var sid = typeof script.id === "string" ? script.id : undefined;
    var result = e(cur, script);
    if (result.error) errors.push({ scriptIndex: i, scriptId: sid, scriptName: name, error: result.error });
    if (result.text !== cur) { applied.push(script); cur = result.text; }
  }
  return { text: cur, applied: applied, errors: errors };
}
self.onmessage = function(ev) {
  var d = ev.data;
  try { var r = x(d.text, d.scripts, d.options); self.postMessage({ id: d.id, ok: true, result: r }); }
  catch (err) { self.postMessage({ id: d.id, ok: false, error: err instanceof Error ? err.message : String(err) }); }
};
`;
