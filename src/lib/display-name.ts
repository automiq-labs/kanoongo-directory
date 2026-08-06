import { bi } from "./bilingual";
import { t, type Lang } from "./translations";

/**
 * Deceased honorific, derived from status at render time rather than stored in
 * the name. `members.is_deceased` drives it for members; a non-empty
 * `spouses.date_of_death` drives it for spouses. Children, spouse relatives and
 * married_daughters rows carry no deceased flag and are out of scope.
 *
 * English uses "Late " for everyone; Hindi is gendered — स्वर्गीया for women,
 * स्वर्गीय otherwise (including unknown gender).
 */

/**
 * Names in the database still contain embedded markers pending a Lane-1
 * cleanup, so every prefix goes through this guard first.
 *
 * Both scripts are checked regardless of the render language on purpose: bi()
 * falls back to the Hindi name when the English one is missing, so an English
 * render can legitimately be handed "स्वर्गीय राम" — matching only the English
 * pattern there would produce "Late स्वर्गीय राम". It also catches the one row
 * whose Hindi field holds Latin "LATE …".
 *
 * The forms below are every variant present in the live data. The abbreviated
 * स्व: / स्व. requires its punctuation: without it the pattern would also match
 * ordinary names beginning स्वे- (e.g. स्वेता) and silently drop their honorific.
 */
const LATE_MARKERS = [
  /^\s*late\b/i, //        "Late …", "LATE …"
  /^\s*स्वर्गीया?\s/, //     "स्वर्गीय …", "स्वर्गीया …"
  /^\s*स्व\s*[:.]/, //      "स्व: …", "स्व:गोविन्द", "स्व. …"
];

export function hasLateMarker(name: string): boolean {
  return LATE_MARKERS.some((re) => re.test(name));
}

/**
 * The name with a leading deceased marker removed, for the editor's "remove it
 * and mark as deceased" action (S22). Driven by the same LATE_MARKERS list as
 * the render-time guard so the two can never disagree — in particular the
 * abbreviated स्व: / स्व. still requires its punctuation, so स्वेता is untouched.
 *
 * Only one marker is stripped: "Late Late X" is a data error worth leaving
 * visible rather than silently tidying.
 */
export function stripLateMarker(name: string): string {
  for (const re of LATE_MARKERS) {
    const m = re.exec(name);
    if (m) return name.slice(m[0].length).trim();
  }
  return name.trim();
}

/** The honorific plus its trailing space, e.g. "Late " / "स्वर्गीया ". */
export function deceasedPrefix(lang: Lang, gender: string | null | undefined): string {
  const key = gender === "F" || gender === "female" ? "honorific_late_f" : "honorific_late";
  return `${t(key, lang)} `;
}

interface BilingualName {
  full_name?: string | null;
  full_name_en?: string | null;
}

export interface MemberNameFields extends BilingualName {
  is_deceased?: boolean | null;
  gender?: string | null;
}

export interface SpouseNameFields extends BilingualName {
  date_of_death?: string | null;
  gender?: string | null;
}

/**
 * The stored name with no honorific — for avatar initials, A–Z sorting,
 * search matching, form inputs and any value written back to the database.
 */
export function rawName(person: BilingualName, lang: Lang): string | null {
  return bi(person.full_name ?? null, person.full_name_en ?? null, lang);
}

function withHonorific(
  name: string | null,
  deceased: boolean,
  gender: string | null | undefined,
  lang: Lang,
): string | null {
  if (!name || !deceased || hasLateMarker(name)) return name;
  return deceasedPrefix(lang, gender) + name;
}

export function memberDisplayName(member: MemberNameFields, lang: Lang): string | null {
  return withHonorific(rawName(member, lang), Boolean(member.is_deceased), member.gender, lang);
}

export function spouseDisplayName(spouse: SpouseNameFields, lang: Lang): string | null {
  // date_of_death is TEXT — treat blank the same as null, as get_celebrations does.
  const deceased = Boolean(spouse.date_of_death && spouse.date_of_death.trim() !== "");
  return withHonorific(rawName(spouse, lang), deceased, spouse.gender, lang);
}
