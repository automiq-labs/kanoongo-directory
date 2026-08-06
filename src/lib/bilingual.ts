import { t, type Lang } from "./translations";

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

/**
 * `members.marital_status` is a stored enum-ish text, `married` / `unmarried`.
 * The family card and the admin child rows printed it raw, so the Hindi toggle
 * left "married" in English on the most-viewed page in the app (S22).
 *
 * Anything outside the two known values is passed through unchanged rather than
 * blanked — an unexpected value should stay visible.
 */
export function maritalStatusLabel(
  value: string | null | undefined,
  lang: Lang,
): string | null {
  const v = (value || "").trim().toLowerCase();
  if (v === "married") return t("marital_married", lang);
  if (v === "unmarried") return t("marital_unmarried", lang);
  return value || null;
}
