import type { Lang } from "./translations";

/**
 * Pick the right value based on language.
 * If English is selected but the _en value is null/empty, fall back to Hindi.
 */
export function bi(
  hiValue: string | null | undefined,
  enValue: string | null | undefined,
  lang: Lang
): string | null {
  if (lang === "en") {
    return enValue || hiValue || null;
  }
  return hiValue || null;
}
