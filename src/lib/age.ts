/**
 * Age parsing + bucketing, shared by the public directory and the admin portal.
 *
 * `dob` is TEXT in the database and only ISO-formatted when present, so both
 * helpers are deliberately defensive: anything that isn't a clean YYYY-MM-DD
 * date falls into "unknown" rather than throwing or producing a bogus age.
 */

export type AgeGroup = "under18" | "18-40" | "40-60" | "60+" | "unknown";

export function parseAge(dob: string | null): number | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const birth = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Deceased members and members with no usable dob both bucket as "unknown". */
export function ageGroup(dob: string | null, isDeceased: boolean): AgeGroup {
  if (isDeceased) return "unknown";
  const age = parseAge(dob);
  if (age === null) return "unknown";
  if (age < 18) return "under18";
  if (age < 40) return "18-40";
  if (age < 60) return "40-60";
  return "60+";
}
