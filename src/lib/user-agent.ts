// Tiny user-agent parser (no external dep). Best-effort.
export function parseUA(ua: string | null | undefined) {
  const s = (ua ?? "").toLowerCase();
  let os = "Unknown";
  let browser = "Unknown";
  let device: "Mobile" | "Tablet" | "Desktop" = "Desktop";

  if (/iphone|ipod/.test(s)) os = "iOS";
  else if (/ipad/.test(s)) { os = "iPadOS"; device = "Tablet"; }
  else if (/android/.test(s)) os = "Android";
  else if (/windows/.test(s)) os = "Windows";
  else if (/mac os x|macintosh/.test(s)) os = "macOS";
  else if (/linux/.test(s)) os = "Linux";

  if (/edg\//.test(s)) browser = "Edge";
  else if (/chrome\//.test(s) && !/edg\//.test(s)) browser = "Chrome";
  else if (/firefox\//.test(s)) browser = "Firefox";
  else if (/safari\//.test(s) && !/chrome\//.test(s)) browser = "Safari";
  else if (/opr\/|opera/.test(s)) browser = "Opera";

  if (/mobi|iphone|android.*mobile/.test(s)) device = "Mobile";
  else if (/tablet|ipad/.test(s)) device = "Tablet";

  return { os, browser, device };
}
