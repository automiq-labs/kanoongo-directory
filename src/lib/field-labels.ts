import { t, type Lang, type TranslationKey } from "./translations";

/**
 * Human labels for the editable columns across the five person tables
 * (members, spouses, children, married_daughters, spouse_relatives).
 *
 * Keyed by the BASE column name — `x` and `x_en` collapse to one entry, so a
 * save touching both `city` and `city_en` reads as a single "City". Columns
 * that mean the same thing to a reader share a label on purpose
 * (`father_name` / `father_name_raw`, `dom` / `date_of_marriage`).
 */
const FIELD_LABEL_KEYS: Record<string, TranslationKey> = {
  // Identity
  full_name: "label_full_name",
  gender: "label_gender",
  gender_confirmed: "adm_child_gender_confirmed",
  education: "label_education",
  occupation: "label_occupation",
  photo_url: "fld_photo",
  notes: "label_notes",
  origin: "fld_origin",

  // Contact
  mobile: "label_mobile",
  mobile_1: "label_mobile",
  mobile_2: "label_mobile_2",
  husband_mobile: "label_husband_mobile",
  sasur_mobile: "label_sasur_mobile",
  email: "label_email",

  // Address
  addr: "label_address",
  addr_line1: "label_addr_line1",
  addr_line2: "label_addr_line2",
  city: "label_city",
  state: "fld_state",
  country: "fld_country",
  pincode: "label_pincode",

  // Family & dates
  gotra: "label_gotra",
  birth_gotra: "label_birth_gotra",
  marital_status: "label_marital_status",
  husband_name: "label_husband_name",
  sasur_name: "label_sasur",
  father_name: "label_father_name",
  father_name_raw: "label_father_name",
  children_note: "label_children_note",
  dob: "label_dob",
  date_of_death: "label_dod",
  date_of_marriage: "label_dom",
  dom: "label_dom",
  is_deceased: "fld_living_status",

  // Relations & links
  relation_code: "label_relation",
  relation_label: "label_relation",
  father_member_id: "fld_father_link",
  d_member_id: "fld_daughter_link",

  // Admin / bookkeeping
  sort_seq: "adm_field_sort_seq",
  needs_review: "adm_needs_review",
  edit_blocked: "fld_edit_permission",
};

/** Fallback for a column with no mapping — readable beats hidden. */
function prettifyFieldName(column: string): string {
  return column.replace(/_/g, " ").trim();
}

export function fieldLabel(column: string, lang: Lang): string {
  const key = FIELD_LABEL_KEYS[column];
  return key ? t(key, lang) : prettifyFieldName(column);
}

/**
 * Pull the changed-column list out of an activity row's `details`:
 * `fields` on activity_log rows (admin edits), `_fields` on edit_history rows.
 * Returns null when the row predates field recording.
 */
export function extractChangedFields(
  details: Record<string, unknown> | null | undefined,
): string[] | null {
  if (!details) return null;
  const raw = Array.isArray(details.fields)
    ? details.fields
    : Array.isArray(details._fields)
      ? details._fields
      : null;
  if (!raw) return null;
  const cols = raw.filter((f): f is string => typeof f === "string" && f.length > 0);
  return cols.length > 0 ? cols : null;
}

/**
 * Turn raw column names into deduped, human-readable labels.
 * Underscore-prefixed metadata keys (`_note`, `_fields`) are never labels.
 */
export function changedFieldLabels(columns: string[] | null | undefined, lang: Lang): string[] {
  if (!columns) return [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const raw of columns) {
    if (typeof raw !== "string" || !raw || raw.startsWith("_")) continue;
    const base = raw.endsWith("_en") ? raw.slice(0, -3) : raw;
    if (!base || seen.has(base)) continue;
    seen.add(base);
    labels.push(fieldLabel(base, lang));
  }
  return labels;
}
