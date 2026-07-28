// Pure helpers to build scannable payloads (client-safe).
import { BRAND } from "./brand";

/** EMV/CRC16-CCITT (poly 0x1021, init 0xFFFF) used by the PIX BR Code. */
function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** EMV TLV field: id + 2-digit length + value (ASCII, so char length == byte length). */
function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

/** PIX requires ASCII, no accents; name ≤25 and city ≤15 chars. */
function pixText(v: string, max: number): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, max)
    .toUpperCase();
}

export type PixInput = {
  key: string;
  name?: string;
  city?: string;
  amount?: string | number | null;
  txid?: string | null;
};

/** Build a static PIX "Copia e Cola" / BR Code payload. Returns "" if no key. */
export function buildPixPayload({ key, name, city, amount, txid }: PixInput): string {
  const k = key.trim();
  if (!k) return "";

  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", k);

  const amountNum = typeof amount === "string" ? parseFloat(amount.replace(",", ".")) : amount ?? 0;
  const hasAmount = typeof amountNum === "number" && !Number.isNaN(amountNum) && amountNum > 0;

  const additional = tlv("05", (txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***");

  const payload =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (hasAmount ? tlv("54", amountNum.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", pixText(name || BRAND.name, 25) || BRAND.name) +
    tlv("60", pixText(city || "BRASIL", 15) || "BRASIL") +
    tlv("62", additional) +
    "6304";

  return payload + crc16(payload);
}

export type VCardInput = {
  first_name?: string;
  last_name?: string;
  org?: string;
  title?: string;
  phone?: string;
  email?: string;
  website?: string;
};

/** Build a vCard 3.0 string (used both for the QR and the .vcf download). */
export function buildVCard(v: VCardInput): string {
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const first = (v.first_name ?? "").trim();
  const last = (v.last_name ?? "").trim();
  const full = [first, last].filter(Boolean).join(" ") || (v.org ?? "").trim();
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(full)}`,
  ];
  if (v.org) lines.push(`ORG:${esc(v.org)}`);
  if (v.title) lines.push(`TITLE:${esc(v.title)}`);
  if (v.phone) lines.push(`TEL;TYPE=CELL:${esc(v.phone)}`);
  if (v.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(v.email)}`);
  if (v.website) lines.push(`URL:${esc(v.website)}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

/** Escape reserved chars in a Wi-Fi QR value. */
function wifiEsc(v: string): string {
  return v.replace(/([\\;,":])/g, "\\$1");
}

export type WifiInput = {
  ssid: string;
  password?: string;
  security?: string; // WPA | WEP | nopass
  hidden?: boolean;
};

/** Build a WIFI: QR payload that phones can auto-connect to. */
export function buildWifiPayload({ ssid, password, security, hidden }: WifiInput): string {
  if (!ssid?.trim()) return "";
  const type = (security || "WPA").toUpperCase();
  const t = type === "NOPASS" || type === "NONE" ? "nopass" : type;
  const pass = t === "nopass" ? "" : wifiEsc(password ?? "");
  return `WIFI:T:${t};S:${wifiEsc(ssid)};P:${pass};H:${hidden ? "true" : "false"};;`;
}
