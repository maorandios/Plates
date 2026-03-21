/**
 * Generates unique 3-character uppercase client codes within a batch.
 * Excludes confusing characters: O (looks like 0), I (looks like 1), Q, Z.
 */

const SAFE_CHARS = "ABCDEFGHJKLMNPRSTUVWXY"; // 22 chars — no O, I, Q, Z

export function generateClientCode(existingCodes: string[]): string {
  const usedCodes = new Set(existingCodes.map((c) => c.toUpperCase()));

  // First try to derive a meaningful code from a sequence
  for (let attempt = 0; attempt < 10000; attempt++) {
    const code = randomCode();
    if (!usedCodes.has(code)) return code;
  }

  // Exhaustive fallback — extremely unlikely to be needed
  for (const a of SAFE_CHARS) {
    for (const b of SAFE_CHARS) {
      for (const c of SAFE_CHARS) {
        const code = `${a}${b}${c}`;
        if (!usedCodes.has(code)) return code;
      }
    }
  }

  throw new Error("Exhausted all available 3-character codes in this batch.");
}

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 3; i++) {
    code += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return code;
}

/**
 * Derive a code hint from the client name (first 3 consonants or letters),
 * then ensure it's unique. Falls back to random if can't derive.
 */
export function deriveClientCode(
  fullName: string,
  existingCodes: string[]
): string {
  const usedCodes = new Set(existingCodes.map((c) => c.toUpperCase()));

  // Extract uppercase letters from name, prefer consonants
  const letters = fullName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .filter((c) => SAFE_CHARS.includes(c));

  if (letters.length >= 3) {
    // Try first 3 letters
    const candidate = letters.slice(0, 3).join("");
    if (!usedCodes.has(candidate)) return candidate;

    // Try initials if multi-word
    const words = fullName
      .toUpperCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    if (words.length >= 3) {
      const initials = words
        .map((w) => w.replace(/[^A-Z]/g, ""))
        .filter((w) => w.length > 0 && SAFE_CHARS.includes(w[0]))
        .map((w) => w[0])
        .slice(0, 3)
        .join("");
      if (initials.length === 3 && !usedCodes.has(initials)) return initials;
    }
  }

  return generateClientCode(existingCodes);
}
