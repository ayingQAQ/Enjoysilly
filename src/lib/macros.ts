export interface MacroReplacementContext {
  characterName?: string;
  nickname?: string;
  userName?: string;
  originalText?: string;
  now?: Date;
  random?: () => number;
}

const macroPattern = /\{\{([^{}]*)\}\}/g;

export function replaceMacros(
  input: string,
  context: MacroReplacementContext = {},
): string {
  return input.replace(macroPattern, (match, rawExpression: string) => {
    const expression = rawExpression.trim();
    const replacement = resolveMacro(expression, context);

    return replacement ?? match;
  });
}

function resolveMacro(
  expression: string,
  context: MacroReplacementContext,
): string | undefined {
  if (expression.startsWith("//")) {
    return "";
  }

  switch (expression) {
    case "char":
      return context.characterName ?? "";
    case "nickname":
      return context.nickname ?? context.characterName ?? "";
    case "user":
      return context.userName ?? "";
    case "original":
      return context.originalText ?? "";
    case "date":
      return formatDate(getCurrentDate(context));
    case "time":
      return formatTime(getCurrentDate(context));
    case "datetime":
      return `${formatDate(getCurrentDate(context))} ${formatTime(
        getCurrentDate(context),
      )}`;
    case "weekday":
      return formatWeekday(getCurrentDate(context));
    case "isoTime":
      return getCurrentDate(context).toISOString();
    case "random":
      return formatRandomNumber(getRandomValue(context));
    default:
      return resolveRandomChoice(expression, context);
  }
}

function resolveRandomChoice(
  expression: string,
  context: MacroReplacementContext,
): string | undefined {
  const options = parseRandomOptions(expression);

  if (options.length === 0) {
    return undefined;
  }

  const selectedIndex = Math.min(
    options.length - 1,
    Math.floor(getRandomValue(context) * options.length),
  );

  return options[selectedIndex];
}

function parseRandomOptions(expression: string): string[] {
  if (expression.startsWith("random::")) {
    return expression
      .slice("random::".length)
      .split("::")
      .map((option) => option.trim())
      .filter(Boolean);
  }

  if (expression.startsWith("random:")) {
    return expression
      .slice("random:".length)
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
  }

  return [];
}

function getCurrentDate(context: MacroReplacementContext): Date {
  return context.now ?? new Date();
}

function getRandomValue(context: MacroReplacementContext): number {
  const value = context.random ? context.random() : Math.random();

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.999999999, Math.max(0, value));
}

function formatRandomNumber(value: number): string {
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate()),
  ].join("-");
}

function formatTime(date: Date): string {
  return [
    pad2(date.getUTCHours()),
    pad2(date.getUTCMinutes()),
    pad2(date.getUTCSeconds()),
  ].join(":");
}

function formatWeekday(date: Date): string {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][date.getUTCDay()];
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
