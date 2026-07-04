export function createSafeJsonFileName(name: string, fallbackName: string): string {
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

  return `${finalName || fallbackName}.json`;
}

function isWindowsReservedFileName(name: string): boolean {
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name);
}
