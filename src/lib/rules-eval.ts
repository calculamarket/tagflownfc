// Pure evaluation of a dynamic redirect rule against a scan context.

export type Platform = "ios" | "android" | "desktop";

export type RuleCtx = {
  platform: Platform;
  country: string | null;
  scanCount: number | null;
  nowMinutes: number; // minutes since midnight in the target timezone
};

function hhmmToMin(s: unknown): number | null {
  if (typeof s !== "string" || !/^\d{1,2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/** Return true if the rule's condition matches the current scan context. */
export function ruleMatches(
  type: string,
  value: Record<string, unknown>,
  ctx: RuleCtx,
): boolean {
  switch (type) {
    case "device":
      return value.platform === ctx.platform;
    case "country": {
      const list = Array.isArray(value.countries) ? (value.countries as string[]) : [];
      const cc = (ctx.country || "").toUpperCase();
      return !!cc && list.map((c) => String(c).toUpperCase()).includes(cc);
    }
    case "time": {
      const from = hhmmToMin(value.from);
      const to = hhmmToMin(value.to);
      if (from == null || to == null) return false;
      return from <= to
        ? ctx.nowMinutes >= from && ctx.nowMinutes <= to
        : ctx.nowMinutes >= from || ctx.nowMinutes <= to;
    }
    case "scan_count": {
      if (ctx.scanCount == null) return false;
      const hasMax = value.max != null && value.max !== "";
      const hasMin = value.min != null && value.min !== "";
      if (hasMax && ctx.scanCount >= Number(value.max)) return false;
      if (hasMin && ctx.scanCount < Number(value.min)) return false;
      return hasMax || hasMin;
    }
    default:
      return false;
  }
}

export function platformFromOs(os: string): Platform {
  if (os === "iOS" || os === "iPadOS") return "ios";
  if (os === "Android") return "android";
  return "desktop";
}

/** Current minutes-since-midnight in a given IANA timezone. */
export function nowMinutesInTz(tz: string): number {
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
