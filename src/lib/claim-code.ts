// Activation codes printed on the paper label that ships with each piece.
// Alphabet excludes visually ambiguous characters (0/O, 1/I/L) so a customer
// typing the code off a label doesn't get tripped up.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 10;

/** Random activation code, formatted for printing as XXXXX-XXXXX. */
export function generateClaimCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

/**
 * Canonical form stored and compared in the database: uppercase, no separators.
 * Lets the customer type it with or without the hyphen, in any case.
 */
export function normalizeClaimCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Display form (XXXXX-XXXXX) from any input. */
export function formatClaimCode(value: string): string {
  const n = normalizeClaimCode(value);
  return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5, 10)}` : n;
}
