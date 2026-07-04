export function createSafeJsonFileName(name: string, fallbackName: string): string {
  return createSafeFileName(name, fallbackName, "json");
}

export function createSafeFileName(
  name: string,
  fallbackName: string,
  extension: string,
): string {
  const normalizedName = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "");
  const safeName = Array.from(normalizedName)
    .slice(0, 80)
    .join("")
    .replace(/[. ]+$/g, "");
  const finalName = isWindowsReservedFileName(safeName)
    ? `_${safeName}`
    : safeName;

  return `${finalName || fallbackName}.${extension}`;
}

function isWindowsReservedFileName(name: string): boolean {
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name);
}
