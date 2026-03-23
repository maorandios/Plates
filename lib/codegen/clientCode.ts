/**
 * Global 3-character client codes: uppercase letters + digits.
 * Avoids confusing glyphs: O, I, Q, Z, 0, 1.
 */

const SAFE_LETTERS = "ABCDEFGHJKLMNPRSTUVWXY";
const SAFE_DIGITS = "23456789";

/** Allowed characters for generated codes (and validation). */
export const CLIENT_CODE_ALPHABET = SAFE_LETTERS + SAFE_DIGITS;

export function isSafeClientCode(code: string): boolean {
  const c = code.toUpperCase();
  if (c.length !== 3) return false;
  for (let i = 0; i < 3; i++) {
    if (!CLIENT_CODE_ALPHABET.includes(c[i])) return false;
  }
  return true;
}

/** True if no entry in `reservedCodes` matches (case-insensitive). */
export function isClientCodeUnique(code: string, reservedCodes: string[]): boolean {
  const u = code.toUpperCase();
  return !reservedCodes.some((c) => c.toUpperCase() === u);
}

/** When editing, allow the same code for `excludeClientId` only. */
export function isClientCodeUniqueAmongClients(
  code: string,
  clients: { id: string; shortCode: string }[],
  excludeClientId?: string
): boolean {
  const u = code.toUpperCase();
  for (const c of clients) {
    if (c.id === excludeClientId) continue;
    if (c.shortCode.toUpperCase() === u) return false;
  }
  return true;
}

export function generateClientCode(existingCodes: string[]): string {
  const usedCodes = new Set(existingCodes.map((c) => c.toUpperCase()));

  for (let attempt = 0; attempt < 20_000; attempt++) {
    const code = randomCode();
    if (!usedCodes.has(code)) return code;
  }

  for (const a of CLIENT_CODE_ALPHABET) {
    for (const b of CLIENT_CODE_ALPHABET) {
      for (const c of CLIENT_CODE_ALPHABET) {
        const code = `${a}${b}${c}`;
        if (!usedCodes.has(code)) return code;
      }
    }
  }

  throw new Error("Exhausted all available 3-character client codes.");
}

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 3; i++) {
    code +=
      CLIENT_CODE_ALPHABET[
        Math.floor(Math.random() * CLIENT_CODE_ALPHABET.length)
      ];
  }
  return code;
}

/**
 * Prefer a mnemonic from the name using safe letters only; otherwise random unique code.
 */
export function deriveClientCode(
  fullName: string,
  existingCodes: string[]
): string {
  const usedCodes = new Set(existingCodes.map((c) => c.toUpperCase()));

  const letters = fullName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .filter((ch) => SAFE_LETTERS.includes(ch));

  if (letters.length >= 3) {
    const candidate = letters.slice(0, 3).join("");
    if (!usedCodes.has(candidate)) return candidate;

    const words = fullName
      .toUpperCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    if (words.length >= 3) {
      const initials = words
        .map((w) => w.replace(/[^A-Z]/g, ""))
        .filter((w) => w.length > 0 && SAFE_LETTERS.includes(w[0]))
        .map((w) => w[0])
        .slice(0, 3)
        .join("");
      if (initials.length === 3 && !usedCodes.has(initials)) return initials;
    }
  }

  return generateClientCode(existingCodes);
}
