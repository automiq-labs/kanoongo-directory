"use client";

import { useState, useEffect, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useLang } from "@/lib/language-context";
import { t, type Lang, type TranslationKey } from "@/lib/translations";
import type { SpouseRelative, MarriedDaughter } from "@/lib/types";
import { bi } from "@/lib/bilingual";
import { transliteratePhrase } from "@/lib/transliterate";

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface SpouseRecord {
  spouse_id: string;
  member_id: string;
  full_name: string;
  full_name_en: string | null;
  gender: string | null;
  birth_gotra: string | null;
  birth_gotra_en: string | null;
  father_name: string | null;
  father_name_en: string | null;
  education: string | null;
  education_en: string | null;
  dob: string | null;
  date_of_marriage: string | null;
  date_of_death: string | null;
  mobile: string | null;
  email: string | null;
  photo_url: string | null;
  removed_at: string | null;
  relatives?: SpouseRelative[] | null;
}

interface ChildRecord {
  child_id: string;
  parent_member_id: string;
  full_name: string;
  full_name_en: string | null;
  gender: string | null;
  gender_confirmed: boolean | null;
  dob: string | null;
  education: string | null;
  education_en: string | null;
  marital_status: string | null;
  occupation: string | null;
  occupation_en: string | null;
  mobile: string | null;
  email: string | null;
  photo_url: string | null;
  removed_at: string | null;
}

interface TreeChild {
  member_id: string;
  full_name: string;
  full_name_en: string | null;
  gender: string | null;
  is_deceased: boolean;
  has_descendants: boolean;
  claimed: boolean;
}

interface FatherRef {
  member_id: string;
  full_name: string;
  full_name_en: string | null;
}

interface MemberDetail {
  member: Record<string, unknown>;
  family: {
    id: string;
    status: string;
    claimed: boolean;
    claim_user_id: string | null;
    claim_email: string | null;
    last_sign_in_at: string | null;
  };
  spouses: SpouseRecord[];
  children: ChildRecord[];
  descendant_count: number;
  married_daughters?: MarriedDaughter[] | null;
  sasural_details?: MarriedDaughter[] | null;
  father: FatherRef | null;
  tree_children: TreeChild[];
  history: Array<{
    changed_at: string;
    changed_by: string | null;
    previous_values: Record<string, unknown> | null;
  }>;
  admin_actions: Array<{
    at: string;
    action: string;
    actor: string | null;
    details: Record<string, unknown> | null;
  }>;
}

/* ═══════════════════════════════════════════════════════════════════════
   Field definitions
   ═══════════════════════════════════════════════════════════════════════ */

interface FieldDef {
  key: string;
  label: TranslationKey;
  group: "identity" | "contact" | "address" | "family" | "notes";
  type?: "text" | "select" | "checkbox" | "textarea";
  options?: string[];
  femaleOnly?: boolean;
  /** If this Hindi field can be auto-filled from its English counterpart, set the English field key here. */
  enCounterpart?: string;
  maxLength?: number;
}

const MEMBER_FIELDS: FieldDef[] = [
  { key: "full_name", label: "adm_field_full_name", group: "identity", enCounterpart: "full_name_en" },
  { key: "full_name_en", label: "adm_field_full_name_en", group: "identity" },
  { key: "gender", label: "adm_field_gender", group: "identity", type: "select", options: ["M", "F"] },
  { key: "education", label: "adm_field_education", group: "identity", enCounterpart: "education_en" },
  { key: "education_en", label: "adm_field_education_en", group: "identity" },
  { key: "occupation", label: "adm_field_occupation", group: "identity", enCounterpart: "occupation_en" },
  { key: "occupation_en", label: "adm_field_occupation_en", group: "identity" },
  { key: "photo_url", label: "adm_field_photo_url", group: "identity" },
  { key: "mobile_1", label: "adm_field_mobile_1", group: "contact" },
  { key: "mobile_2", label: "adm_field_mobile_2", group: "contact" },
  { key: "email", label: "adm_field_email", group: "contact" },
  { key: "addr_line1", label: "adm_field_addr_line1", group: "address", enCounterpart: "addr_line1_en" },
  { key: "addr_line1_en", label: "adm_field_addr_line1_en", group: "address" },
  { key: "addr_line2", label: "adm_field_addr_line2", group: "address", enCounterpart: "addr_line2_en" },
  { key: "addr_line2_en", label: "adm_field_addr_line2_en", group: "address" },
  { key: "city", label: "adm_field_city", group: "address", enCounterpart: "city_en" },
  { key: "city_en", label: "adm_field_city_en", group: "address" },
  { key: "state", label: "adm_field_state", group: "address", enCounterpart: "state_en" },
  { key: "state_en", label: "adm_field_state_en", group: "address" },
  { key: "country", label: "adm_field_country", group: "address", enCounterpart: "country_en" },
  { key: "country_en", label: "adm_field_country_en", group: "address" },
  { key: "pincode", label: "adm_field_pincode", group: "address" },
  { key: "gotra", label: "adm_field_gotra", group: "family", enCounterpart: "gotra_en" },
  { key: "gotra_en", label: "adm_field_gotra_en", group: "family" },
  { key: "marital_status", label: "adm_field_marital_status", group: "family", femaleOnly: true },
  { key: "husband_name", label: "adm_field_husband_name", group: "family", femaleOnly: true, enCounterpart: "husband_name_en" },
  { key: "husband_name_en", label: "adm_field_husband_name_en", group: "family", femaleOnly: true },
  { key: "origin", label: "adm_field_origin", group: "family" },
  { key: "father_name_raw", label: "adm_field_father_name_raw", group: "family" },
  { key: "father_member_id", label: "adm_field_father_member_id", group: "family" },
  { key: "dob", label: "adm_field_dob", group: "family" },
  { key: "date_of_death", label: "adm_field_date_of_death", group: "family" },
  { key: "is_deceased", label: "adm_field_is_deceased", group: "family", type: "checkbox" },
  { key: "sort_seq", label: "adm_field_sort_seq", group: "family" },
  // Notes
  { key: "notes", label: "adm_field_notes", group: "notes", type: "textarea", maxLength: 1000, enCounterpart: "notes_en" },
  { key: "notes_en", label: "adm_field_notes_en", group: "notes", type: "textarea", maxLength: 1000 },
];

const GROUP_LABELS: Record<string, TranslationKey> = {
  identity: "adm_group_identity",
  contact: "adm_group_contact",
  address: "adm_group_address",
  family: "adm_group_family",
  notes: "adm_group_notes",
};

interface SimpleFieldDef { key: string; label: TranslationKey; type?: "text" | "select" | "checkbox" | "textarea"; options?: string[]; enCounterpart?: string; maxLength?: number }

const SPOUSE_FIELDS: SimpleFieldDef[] = [
  { key: "full_name", label: "adm_field_full_name", enCounterpart: "full_name_en" },
  { key: "full_name_en", label: "adm_field_full_name_en" },
  { key: "gender", label: "adm_field_gender", type: "select", options: ["M", "F"] },
  { key: "father_name", label: "adm_spouse_father_name", enCounterpart: "father_name_en" },
  { key: "father_name_en", label: "adm_spouse_father_name_en" },
  { key: "birth_gotra", label: "adm_spouse_birth_gotra", enCounterpart: "birth_gotra_en" },
  { key: "birth_gotra_en", label: "adm_spouse_birth_gotra_en" },
  { key: "dob", label: "adm_field_dob" },
  { key: "date_of_marriage", label: "adm_spouse_dom" },
  { key: "date_of_death", label: "adm_field_date_of_death" },
  { key: "education", label: "adm_field_education", enCounterpart: "education_en" },
  { key: "education_en", label: "adm_field_education_en" },
  { key: "email", label: "adm_field_email" },
  { key: "mobile", label: "adm_spouse_mobile" },
  { key: "photo_url", label: "adm_field_photo_url" },
  { key: "notes", label: "adm_field_notes", type: "textarea", maxLength: 1000, enCounterpart: "notes_en" },
  { key: "notes_en", label: "adm_field_notes_en", type: "textarea", maxLength: 1000 },
];

const CHILD_FIELDS: SimpleFieldDef[] = [
  { key: "full_name", label: "adm_field_full_name", enCounterpart: "full_name_en" },
  { key: "full_name_en", label: "adm_field_full_name_en" },
  { key: "gender", label: "adm_field_gender", type: "select", options: ["M", "F"] },
  { key: "dob", label: "adm_field_dob" },
  { key: "education", label: "adm_field_education", enCounterpart: "education_en" },
  { key: "education_en", label: "adm_field_education_en" },
  { key: "marital_status", label: "adm_child_marital" },
  { key: "occupation", label: "adm_field_occupation", enCounterpart: "occupation_en" },
  { key: "occupation_en", label: "adm_field_occupation_en" },
  { key: "mobile", label: "adm_spouse_mobile" },
  { key: "email", label: "adm_field_email" },
  { key: "photo_url", label: "adm_field_photo_url" },
  { key: "gender_confirmed", label: "adm_child_gender_confirmed", type: "checkbox" },
  { key: "notes", label: "adm_field_notes", type: "textarea", maxLength: 1000, enCounterpart: "notes_en" },
  { key: "notes_en", label: "adm_field_notes_en", type: "textarea", maxLength: 1000 },
];

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

/** Compute dirty fields between form vals and an original record. Empty string → null for deliberate clears. */
function dirtyDiff(vals: Record<string, unknown>, orig: Record<string, unknown>): Record<string, unknown> {
  const dirty: Record<string, unknown> = {};
  for (const k of Object.keys(vals)) {
    const newVal = String(vals[k] ?? "").trim();
    const origVal = (orig[k] ?? "").toString().trim();
    if (newVal !== origVal) {
      dirty[k] = newVal || null;
    }
  }
  return dirty;
}

/** Init form values from a record, converting null → "" */
function initFormVals(rec: Record<string, unknown>, keys: string[]): Record<string, string> {
  const vals: Record<string, string> = {};
  for (const k of keys) vals[k] = String(rec[k] ?? "");
  return vals;
}

const RELATIVE_EDIT_KEYS = [
  "relation_code", "relation_label", "relation_label_en",
  "full_name", "full_name_en", "addr", "addr_en", "city", "city_en",
  "mobile", "occupation", "occupation_en", "notes", "notes_en",
];

const MD_EDIT_KEYS = [
  "relation_label", "relation_label_en", "full_name", "full_name_en",
  "husband_name", "husband_name_en", "sasur_name", "sasur_name_en",
  "addr", "addr_en", "city", "city_en", "mobile", "husband_mobile",
  "sasur_mobile", "email", "education", "education_en", "occupation",
  "occupation_en", "dom", "children_note", "children_note_en",
  "notes", "notes_en", "needs_review",
];

function isFemaleGender(gender: unknown): boolean {
  return String(gender || "").toUpperCase().startsWith("F");
}

function genderLabel(gender: unknown, lang: Lang): string {
  const g = String(gender || "").toUpperCase();
  if (g.startsWith("F")) return t("adm_gender_f", lang);
  if (g.startsWith("M")) return t("adm_gender_m", lang);
  return String(gender || "—");
}

function relativeTime(iso: string | null, lang: string): string {
  if (!iso) return lang === "en" ? "Never" : "कभी नहीं";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return lang === "en" ? "just now" : "अभी";
  const min = Math.floor(sec / 60);
  if (min < 60) return lang === "en" ? `${min}m ago` : `${min} मि. पहले`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return lang === "en" ? `${hr}h ago` : `${hr} घं. पहले`;
  const d = Math.floor(hr / 24);
  if (d < 30) return lang === "en" ? `${d}d ago` : `${d} दिन पहले`;
  const mo = Math.floor(d / 30);
  return lang === "en" ? `${mo}mo ago` : `${mo} माह पहले`;
}

function mapServerError(code: string, lang: Lang): string {
  if (code.includes("invalid_dob_format")) return t("adm_invalid_dob", lang);
  if (code.includes("notes") && (code.includes("constraint") || code.includes("1000") || code.includes("too long"))) return t("notes_too_long", lang);
  return code;
}

function computeDirty(
  vals: Record<string, unknown>,
  orig: Record<string, unknown>,
  fieldDefs: SimpleFieldDef[],
): Record<string, unknown> {
  const dirty: Record<string, unknown> = {};
  for (const f of fieldDefs) {
    const o = String(orig[f.key] ?? "");
    const c = String(vals[f.key] ?? "");
    if (o !== c) {
      if (f.type === "checkbox") dirty[f.key] = Boolean(vals[f.key]);
      else dirty[f.key] = vals[f.key] === "" ? null : vals[f.key];
    }
  }
  return dirty;
}

function recordToValues(rec: Record<string, unknown>, fields: SimpleFieldDef[]): Record<string, unknown> {
  const vals: Record<string, unknown> = {};
  for (const f of fields) vals[f.key] = rec[f.key] ?? "";
  return vals;
}

const INPUT_CLS =
  "min-h-[40px] w-full rounded-[var(--r-sm)] border border-[#ECE0C8] bg-white px-3 py-2 text-sm text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none";

/* ═══════════════════════════════════════════════════════════════════════
   Inline field renderer
   ═══════════════════════════════════════════════════════════════════════ */

function FieldInput({
  field,
  value,
  onChange,
  lang,
  onFillHindi,
  fillBusy,
  fillMsg,
}: {
  field: SimpleFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  lang: Lang;
  /** If set, show the "हिंदी भरें" button */
  onFillHindi?: () => void;
  fillBusy?: boolean;
  fillMsg?: string;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-[#ECE0C8] text-[var(--maroon)] focus:ring-[var(--gold)]"
        />
        <span className="text-sm text-[var(--maroon-deep)]">
          {Boolean(value) ? t("adm_yes", lang) : t("adm_no", lang)}
        </span>
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <select value={String(value || "")} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS}>
        <option value="">—</option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt === "M" || opt === "F" ? genderLabel(opt, lang) : opt}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "textarea") {
    const strVal = String(value ?? "");
    return (
      <div>
        <div className="flex gap-1.5">
          <textarea
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            maxLength={field.maxLength}
            className={`${INPUT_CLS} min-h-[80px] resize-y`}
          />
          {onFillHindi && (
            <button
              type="button"
              onClick={onFillHindi}
              disabled={fillBusy}
              className="shrink-0 self-start mt-1 min-h-[40px] rounded-[var(--r-sm)] border border-[var(--gold)]/50 px-2.5 text-[11px] font-medium text-[var(--gold-deep)] hover:bg-[rgba(201,150,46,0.08)] disabled:opacity-50"
            >
              {fillBusy ? "…" : t("adm_fill_hindi", lang)}
            </button>
          )}
        </div>
        {field.maxLength && <p className="mt-1 text-right text-[11px] text-[var(--muted)]">{strVal.length} / {field.maxLength}</p>}
        {fillMsg && <p className="mt-1 text-[11px] text-[var(--muted)]">{fillMsg}</p>}
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLS}
        />
        {onFillHindi && (
          <button
            type="button"
            onClick={onFillHindi}
            disabled={fillBusy}
            className="shrink-0 min-h-[40px] rounded-[var(--r-sm)] border border-[var(--gold)]/50 px-2.5 text-[11px] font-medium text-[var(--gold-deep)] hover:bg-[rgba(201,150,46,0.08)] disabled:opacity-50"
          >
            {fillBusy ? "…" : t("adm_fill_hindi", lang)}
          </button>
        )}
      </div>
      {fillMsg && <p className="mt-1 text-[11px] text-[var(--muted)]">{fillMsg}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════════════ */

export default function AdminMemberDetail({
  memberId,
  supabase,
  onClose,
  onRefresh,
}: {
  memberId: string;
  supabase: SupabaseClient;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { lang } = useLang();

  /* ── Navigation stack ─────────────────────────────────────────── */
  const [navStack, setNavStack] = useState<string[]>([memberId]);
  const currentId = navStack[navStack.length - 1];

  function navigateTo(id: string) {
    setNavStack((prev) => [...prev, id]);
  }
  function navigateBack() {
    if (navStack.length > 1) setNavStack((prev) => prev.slice(0, -1));
    else onClose();
  }

  /* ── Core state ───────────────────────────────────────────────── */
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ── Member edit ──────────────────────────────────────────────── */
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  /* ── Spouse edit/add ──────────────────────────────────────────── */
  const [editingSpouseId, setEditingSpouseId] = useState<string | null>(null);
  const [spouseEdits, setSpouseEdits] = useState<Record<string, unknown>>({});
  const [spouseOriginal, setSpouseOriginal] = useState<Record<string, unknown>>({});
  const [spouseSaving, setSpouseSaving] = useState(false);
  const [spouseMsg, setSpouseMsg] = useState("");
  const [removeSpouseConfirm, setRemoveSpouseConfirm] = useState<string | null>(null);
  const [showAddSpouse, setShowAddSpouse] = useState(false);
  const [addSpouseVals, setAddSpouseVals] = useState<Record<string, string>>({});
  const [addSpouseSaving, setAddSpouseSaving] = useState(false);

  /* ── Child edit/add ───────────────────────────────────────────── */
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [childEdits, setChildEdits] = useState<Record<string, unknown>>({});
  const [childOriginal, setChildOriginal] = useState<Record<string, unknown>>({});
  const [childSaving, setChildSaving] = useState(false);
  const [childMsg, setChildMsg] = useState("");
  const [removeChildConfirm, setRemoveChildConfirm] = useState<string | null>(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [addChildVals, setAddChildVals] = useState<Record<string, string>>({});
  const [addChildSaving, setAddChildSaving] = useState(false);

  /* ── Promote / mark-married ───────────────────────────────────── */
  const [promoteChildId, setPromoteChildId] = useState<string | null>(null);
  const [promoteHusbandName, setPromoteHusbandName] = useState("");
  const [promoteHusbandNameEn, setPromoteHusbandNameEn] = useState("");
  const [promoteSaving, setPromoteSaving] = useState(false);
  const [markMarriedConfirm, setMarkMarriedConfirm] = useState(false);
  const [markMarriedSaving, setMarkMarriedSaving] = useState(false);

  /* ── Hindi auto-fill (transliteration) ─────────────────────────── */
  const [fillingField, setFillingField] = useState<string | null>(null);
  const [fillMessages, setFillMessages] = useState<Record<string, string>>({});
  const [fillingAll, setFillingAll] = useState<string | null>(null); // "member" | "spouse" | "child" | null

  /* ── Tree children expand ─────────────────────────────────────── */
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [subChildren, setSubChildren] = useState<Record<string, TreeChild[]>>({});

  /* ── Danger zone ──────────────────────────────────────────────── */
  const [dangerOpen, setDangerOpen] = useState(false);
  const [unlinkConfirm, setUnlinkConfirm] = useState(false);
  const [deleteAuthConfirm, setDeleteAuthConfirm] = useState(false);
  const [cascadeInput, setCascadeInput] = useState("");
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerMsg, setDangerMsg] = useState("");

  /* ── Inline action feedback ───────────────────────────────────── */
  const [actionLoading, setActionLoading] = useState(false);

  /* ── Fetch detail ─────────────────────────────────────────────── */
  const fetchDetail = useCallback(
    async (id: string) => {
      setLoading(true);
      setError("");
      // Reset sub-states
      setEditingSpouseId(null);
      setEditingChildId(null);
      setShowAddSpouse(false);
      setShowAddChild(false);
      setDangerOpen(false);
      setDangerMsg("");
      setSaveMsg("");
      setSpouseMsg("");
      setChildMsg("");
      setPromoteChildId(null);
      setMarkMarriedConfirm(false);
      setExpandedNodes(new Set());
      setSubChildren({});

      const { data, error: err } = await supabase.rpc("admin_get_member_detail", {
        p_member_id: id,
      });
      if (err) {
        setError(err.message);
      } else if (data) {
        const d = data as MemberDetail;
        setDetail(d);
        const vals: Record<string, unknown> = {};
        for (const f of MEMBER_FIELDS) {
          vals[f.key] = (d.member as Record<string, unknown>)[f.key] ?? "";
        }
        setEditValues(vals);
        setOriginalValues({ ...vals });
      }
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching effect, setState in async callback
    fetchDetail(currentId);
  }, [currentId, fetchDetail]);

  // Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  /* ── Member edit handlers ─────────────────────────────────────── */
  function setField(key: string, value: unknown) {
    setSaveMsg("");
    setEditValues((prev) => ({ ...prev, [key]: value }));
  }

  function getMemberDirty(): Record<string, unknown> {
    const dirty: Record<string, unknown> = {};
    for (const key of Object.keys(editValues)) {
      const o = String(originalValues[key] ?? "");
      const c = String(editValues[key] ?? "");
      if (o !== c) {
        const fd = MEMBER_FIELDS.find((f) => f.key === key);
        if (fd?.type === "checkbox") dirty[key] = Boolean(editValues[key]);
        else dirty[key] = editValues[key] === "" ? null : editValues[key];
      }
    }
    return dirty;
  }

  async function handleSaveMember() {
    const dirty = getMemberDirty();
    if (Object.keys(dirty).length === 0) { setSaveMsg(t("adm_no_changes", lang)); return; }
    setSaving(true);
    setSaveMsg("");
    const { error: err } = await supabase.rpc("admin_update_member", {
      p_member_id: currentId,
      p_fields: dirty,
    });
    if (err) setSaveMsg(mapServerError(err.message, lang));
    else { setSaveMsg(t("adm_saved", lang)); await fetchDetail(currentId); onRefresh(); }
    setSaving(false);
  }

  /* ── Spouse handlers ──────────────────────────────────────────── */
  function startEditSpouse(sp: SpouseRecord) {
    setEditingSpouseId(sp.spouse_id);
    const vals = recordToValues(sp as unknown as Record<string, unknown>, SPOUSE_FIELDS);
    setSpouseEdits(vals);
    setSpouseOriginal({ ...vals });
    setSpouseMsg("");
  }

  async function handleSaveSpouse() {
    if (!editingSpouseId) return;
    const dirty = computeDirty(spouseEdits, spouseOriginal, SPOUSE_FIELDS);
    if (Object.keys(dirty).length === 0) { setSpouseMsg(t("adm_no_changes", lang)); return; }
    setSpouseSaving(true);
    setSpouseMsg("");
    const { error: err } = await supabase.rpc("admin_update_spouse", {
      p_spouse_id: editingSpouseId,
      p_fields: dirty,
    });
    if (err) setSpouseMsg(mapServerError(err.message, lang));
    else { setSpouseMsg(t("adm_saved", lang)); setEditingSpouseId(null); await fetchDetail(currentId); onRefresh(); }
    setSpouseSaving(false);
  }

  async function handleRemoveSpouse(id: string) {
    setActionLoading(true);
    await supabase.rpc("delete_spouse", { p_spouse_id: id });
    setRemoveSpouseConfirm(null);
    await fetchDetail(currentId);
    onRefresh();
    setActionLoading(false);
  }

  async function handleRestoreSpouse(id: string) {
    setActionLoading(true);
    await supabase.rpc("restore_spouse", { p_spouse_id: id });
    await fetchDetail(currentId);
    onRefresh();
    setActionLoading(false);
  }

  async function handleAddSpouse() {
    setAddSpouseSaving(true);
    const { error: err } = await supabase.rpc("add_spouse", {
      p_member_id: currentId,
      p_full_name: addSpouseVals.full_name?.trim() || "",
      p_full_name_en: addSpouseVals.full_name_en?.trim() || null,
      p_gender: addSpouseVals.gender || null,
      p_father_name: addSpouseVals.father_name?.trim() || null,
      p_father_name_en: addSpouseVals.father_name_en?.trim() || null,
      p_birth_gotra: addSpouseVals.birth_gotra?.trim() || null,
      p_birth_gotra_en: addSpouseVals.birth_gotra_en?.trim() || null,
      p_dob: addSpouseVals.dob || null,
      p_education: addSpouseVals.education?.trim() || null,
      p_education_en: addSpouseVals.education_en?.trim() || null,
    });
    if (!err) { setShowAddSpouse(false); setAddSpouseVals({}); await fetchDetail(currentId); onRefresh(); }
    setAddSpouseSaving(false);
  }

  /* ── Child handlers ───────────────────────────────────────────── */
  function startEditChild(ch: ChildRecord) {
    setEditingChildId(ch.child_id);
    const vals = recordToValues(ch as unknown as Record<string, unknown>, CHILD_FIELDS);
    setChildEdits(vals);
    setChildOriginal({ ...vals });
    setChildMsg("");
  }

  async function handleSaveChild() {
    if (!editingChildId) return;
    const dirty = computeDirty(childEdits, childOriginal, CHILD_FIELDS);
    if (Object.keys(dirty).length === 0) { setChildMsg(t("adm_no_changes", lang)); return; }
    setChildSaving(true);
    setChildMsg("");
    const { error: err } = await supabase.rpc("admin_update_child", {
      p_child_id: editingChildId,
      p_fields: dirty,
    });
    if (err) setChildMsg(mapServerError(err.message, lang));
    else { setChildMsg(t("adm_saved", lang)); setEditingChildId(null); await fetchDetail(currentId); onRefresh(); }
    setChildSaving(false);
  }

  async function handleRemoveChild(id: string) {
    setActionLoading(true);
    await supabase.rpc("delete_child", { p_child_id: id });
    setRemoveChildConfirm(null);
    await fetchDetail(currentId);
    onRefresh();
    setActionLoading(false);
  }

  async function handleRestoreChild(id: string) {
    setActionLoading(true);
    await supabase.rpc("restore_child", { p_child_id: id });
    await fetchDetail(currentId);
    onRefresh();
    setActionLoading(false);
  }

  async function handleAddChild() {
    setAddChildSaving(true);
    const { error: err } = await supabase.rpc("add_child", {
      p_parent_member_id: currentId,
      p_full_name: addChildVals.full_name?.trim() || "",
      p_full_name_en: addChildVals.full_name_en?.trim() || null,
      p_gender: addChildVals.gender || null,
      p_dob: addChildVals.dob || null,
      p_education: addChildVals.education?.trim() || null,
      p_education_en: addChildVals.education_en?.trim() || null,
      p_marital_status: addChildVals.marital_status?.trim() || null,
    });
    if (!err) { setShowAddChild(false); setAddChildVals({}); await fetchDetail(currentId); onRefresh(); }
    setAddChildSaving(false);
  }

  async function handlePromoteChild() {
    if (!promoteChildId) return;
    setPromoteSaving(true);
    const child = detail?.children.find((c) => c.child_id === promoteChildId);
    const { error: err } = await supabase.rpc("promote_child_to_member", {
      p_child_id: promoteChildId,
      p_husband_name: isFemaleGender(child?.gender) ? (promoteHusbandName.trim() || null) : null,
      p_husband_name_en: isFemaleGender(child?.gender) ? (promoteHusbandNameEn.trim() || null) : null,
    });
    if (!err) { setPromoteChildId(null); setPromoteHusbandName(""); setPromoteHusbandNameEn(""); await fetchDetail(currentId); onRefresh(); }
    setPromoteSaving(false);
  }

  async function handleMarkMarried() {
    setMarkMarriedSaving(true);
    const gender = detail?.member.gender as string | null;
    await supabase.rpc("mark_member_married", { p_member_id: currentId, p_gender: gender || null });
    setMarkMarriedConfirm(false);
    await fetchDetail(currentId);
    onRefresh();
    setMarkMarriedSaving(false);
  }

  /* ── Tree expand ──────────────────────────────────────────────── */
  async function toggleTreeExpand(nodeId: string) {
    const next = new Set(expandedNodes);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
      if (!subChildren[nodeId]) {
        const { data } = await supabase.rpc("admin_get_member_detail", { p_member_id: nodeId });
        if (data) {
          const d = data as MemberDetail;
          setSubChildren((prev) => ({ ...prev, [nodeId]: d.tree_children || [] }));
        }
      }
    }
    setExpandedNodes(next);
  }

  /* ── Hindi auto-fill handlers ──────────────────────────────────── */

  /**
   * Fill a single Hindi field from its English counterpart.
   * `scope` / `vals` / `setter` identify which edit form (member, spouse, child).
   */
  async function fillOneHindiField(
    hiKey: string,
    enKey: string,
    vals: Record<string, unknown>,
    setter: (fn: (prev: Record<string, unknown>) => Record<string, unknown>) => void,
    markDirty?: () => void,
  ): Promise<boolean> {
    const enVal = String(vals[enKey] ?? "").trim();
    const hiVal = String(vals[hiKey] ?? "").trim();
    if (!enVal || hiVal) return true; // nothing to fill or already filled
    setFillingField(hiKey);
    setFillMessages((p) => { const n = { ...p }; delete n[hiKey]; return n; });
    const result = await transliteratePhrase(enVal);
    if (result) {
      setter((p) => ({ ...p, [hiKey]: result }));
      markDirty?.();
      setFillingField(null);
      return true;
    }
    setFillMessages((p) => ({ ...p, [hiKey]: t("adm_fill_unavailable", lang) }));
    setFillingField(null);
    return false;
  }

  async function handleFillAllHindi(
    scope: string,
    fields: (SimpleFieldDef | FieldDef)[],
    vals: Record<string, unknown>,
    setter: (fn: (prev: Record<string, unknown>) => Record<string, unknown>) => void,
    markDirty?: () => void,
  ) {
    setFillingAll(scope);
    setFillMessages({});
    const eligible = fields.filter((f) => f.enCounterpart);
    for (const f of eligible) {
      // Read latest vals from setter (closure over latest state)
      await fillOneHindiField(f.key, f.enCounterpart!, vals, setter, markDirty);
      // Update vals reference to reflect the set — we re-read via a trick:
      // Since setter is a React state setter, the next iteration picks up the latest via closure.
    }
    setFillingAll(null);
  }

  /* ── Danger zone handlers ─────────────────────────────────────── */
  async function handleUnlink() {
    setDangerLoading(true);
    setDangerMsg("");
    const { error: err } = await supabase.rpc("admin_unlink_claim", { p_member_id: currentId });
    if (err) setDangerMsg(err.message);
    else { setDangerMsg(t("adm_unlinked", lang)); setUnlinkConfirm(false); await fetchDetail(currentId); onRefresh(); }
    setDangerLoading(false);
  }

  async function handleDeleteAuth() {
    if (!detail?.family.claim_user_id) return;
    setDangerLoading(true);
    setDangerMsg("");
    const { error: err } = await supabase.rpc("admin_delete_auth_user", { p_user_id: detail.family.claim_user_id });
    if (err) setDangerMsg(err.message);
    else { setDangerMsg(t("adm_auth_deleted", lang)); setDeleteAuthConfirm(false); await fetchDetail(currentId); onRefresh(); }
    setDangerLoading(false);
  }

  async function handleCascadeDelete() {
    setDangerLoading(true);
    setDangerMsg("");
    const { data, error: err } = await supabase.rpc("admin_delete_member_cascade", {
      p_member_id: currentId,
      p_confirm: cascadeInput.trim(),
    });
    if (err) setDangerMsg(err.message);
    else if (data) {
      const d = data as { member_count: number; snapshot_id: string };
      setDangerMsg(t("adm_cascade_success", lang).replace("{count}", String(d.member_count)).replace("{snapshot}", d.snapshot_id || "—"));
      setTimeout(() => { onClose(); onRefresh(); }, 2000);
    }
    setDangerLoading(false);
  }

  /* ── Derived ──────────────────────────────────────────────────── */
  const memberName = detail ? bi(detail.member.full_name as string | null, detail.member.full_name_en as string | null, lang) : "";
  const memberGenderIsFemale = isFemaleGender(editValues.gender);
  const activeSpouses = detail?.spouses.filter((s) => !s.removed_at) ?? [];
  const removedSpouses = detail?.spouses.filter((s) => s.removed_at) ?? [];
  const activeChildren = detail?.children.filter((c) => !c.removed_at) ?? [];
  const removedChildren = detail?.children.filter((c) => c.removed_at) ?? [];
  const memberMaritalStatus = String(detail?.member.marital_status ?? "").toLowerCase();
  const isUnmarried = !memberMaritalStatus || memberMaritalStatus === "unmarried";
  const groups = ["identity", "contact", "address", "family", "notes"] as const;

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center motion-safe:animate-[fadeIn_200ms_ease-out]"
      style={{ background: "rgba(30,8,12,0.55)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-[var(--raised)] shadow-xl sm:rounded-2xl sm:mx-4 motion-safe:animate-[slideUp_250ms_ease-out] sm:animate-none"
        style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            {navStack.length > 1 && (
              <button
                onClick={navigateBack}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--gold-deep)] hover:bg-[var(--cream-panel)]"
                aria-label={t("adm_navigate_back", lang)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="font-display text-lg font-semibold text-[var(--maroon)]">
              {t("adm_detail_title", lang)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--cream-panel)] hover:text-[var(--maroon)]"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-6 w-3/4 animate-pulse rounded bg-[var(--cream-panel)]" />)}
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : detail ? (
            <>
              {/* Name & ID */}
              <div className="mb-4">
                <p className="font-display text-xl font-semibold text-[var(--maroon-deep)]">{memberName}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{currentId}</p>
              </div>

              {/* Claim status */}
              <div className="mb-4 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t("adm_claim_status", lang)}</p>
                {detail.family.claimed ? (
                  <div className="mt-1.5">
                    <p className="text-sm text-[var(--maroon-deep)]">
                      <span className="inline-block h-2 w-2 rounded-full bg-[var(--gold)] mr-1.5" />
                      {t("adm_claimed_by", lang)}: <span className="font-medium">{detail.family.claim_email}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{t("adm_last_sign_in", lang)}: {relativeTime(detail.family.last_sign_in_at, lang)}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-[var(--muted)]">{t("adm_unclaimed_label", lang)}</p>
                )}
                {/* Edit blocking toggle */}
                <div className="mt-2 border-t border-[var(--hairline)] pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {detail.member.edit_blocked ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(110,30,42,0.08)]">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-[var(--maroon)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </span>
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(34,139,34,0.06)]">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-[var(--maroon-deep)]">
                          {detail.member.edit_blocked ? t("adm_edit_blocked", lang) : t("adm_edit_allowed", lang)}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">{t("adm_edit_blocked_desc", lang)}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!window.confirm(t("adm_edit_block_confirm", lang))) return;
                        const newVal = !detail.member.edit_blocked;
                        await supabase.rpc("admin_update_member", { p_member_id: currentId, p_fields: { edit_blocked: newVal } });
                        await fetchDetail(currentId);
                        onRefresh();
                      }}
                      className={`ml-3 min-h-[32px] shrink-0 rounded-[var(--r-sm)] px-3 py-1 text-[11px] font-medium ${
                        detail.member.edit_blocked
                          ? "border border-green-500/40 text-green-700 hover:bg-[rgba(34,139,34,0.06)]"
                          : "border border-[var(--maroon)]/40 text-[var(--maroon)] hover:bg-[rgba(110,30,42,0.06)]"
                      }`}
                    >
                      {detail.member.edit_blocked ? t("adm_allow_editing", lang) : t("adm_block_editing", lang)}
                    </button>
                  </div>
                  {/* D-member note for married daughters */}
                  {currentId.startsWith("D") && (
                    <p className="mt-1.5 rounded-[var(--r-sm)] bg-[rgba(201,150,46,0.08)] px-2.5 py-1.5 text-[11px] text-[var(--gold-deep)]">
                      {t("adm_daughter_edit_note", lang)}
                    </p>
                  )}
                </div>
              </div>

              {/* Stat pills */}
              <div className="mb-5 grid grid-cols-3 gap-3">
                <div className="rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-2.5 text-center">
                  <p className="font-display text-lg font-bold text-[var(--maroon)]">{activeSpouses.length}</p>
                  <p className="text-[11px] text-[var(--muted)]">{t("adm_spouses", lang)}</p>
                </div>
                <div className="rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-2.5 text-center">
                  <p className="font-display text-lg font-bold text-[var(--maroon)]">{activeChildren.length}</p>
                  <p className="text-[11px] text-[var(--muted)]">{t("adm_children", lang)}</p>
                </div>
                <div className="rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-2.5 text-center">
                  <p className="font-display text-lg font-bold text-[var(--maroon)]">{detail.descendant_count}</p>
                  <p className="text-[11px] text-[var(--muted)]">{t("adm_descendants", lang)}</p>
                </div>
              </div>

              {/* ══════ SECTION A: MEMBER EDIT ══════════════════════ */}
              <div className="mb-5 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-base font-semibold text-[var(--maroon)]">{t("adm_edit_member", lang)}</h3>
                  <button
                    onClick={() => handleFillAllHindi("member", MEMBER_FIELDS, editValues, setEditValues, () => setSaveMsg(""))}
                    disabled={!!fillingAll || !!fillingField}
                    className="flex items-center gap-1.5 min-h-[32px] rounded-[var(--r-sm)] border border-[var(--gold)]/50 px-3 py-1 text-[11px] font-medium text-[var(--gold-deep)] hover:bg-[rgba(201,150,46,0.08)] disabled:opacity-50"
                  >
                    {fillingAll === "member" && <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-[var(--gold)] border-t-transparent" />}
                    {t("adm_fill_all_hindi", lang)}
                  </button>
                </div>
                {groups.map((group) => {
                  const fields = MEMBER_FIELDS.filter((f) => f.group === group && (!f.femaleOnly || memberGenderIsFemale));
                  return (
                    <div key={group} className="mb-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--gold-deep)]">{t(GROUP_LABELS[group], lang)}</p>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {fields.map((f) => {
                          const showFill = f.enCounterpart && String(editValues[f.enCounterpart] ?? "").trim() && !String(editValues[f.key] ?? "").trim();
                          return (
                            <div key={f.key}>
                              <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t(f.label, lang)}</label>
                              <FieldInput
                                field={f}
                                value={editValues[f.key]}
                                onChange={(v) => setField(f.key, v)}
                                lang={lang}
                                onFillHindi={showFill ? () => fillOneHindiField(f.key, f.enCounterpart!, editValues, setEditValues, () => setSaveMsg("")) : undefined}
                                fillBusy={fillingField === f.key}
                                fillMsg={fillMessages[f.key]}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-3">
                  <button onClick={handleSaveMember} disabled={saving || Object.keys(getMemberDirty()).length === 0} className="min-h-[40px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-5 text-sm font-medium text-[var(--ivory)] hover:bg-[var(--maroon-deep)] disabled:opacity-50">
                    {saving ? t("adm_saving", lang) : t("adm_save_changes", lang)}
                  </button>
                  {saveMsg && <p className={`text-sm ${saveMsg === t("adm_saved", lang) ? "text-green-700" : "text-[var(--maroon)]"}`}>{saveMsg}</p>}
                </div>
                {isUnmarried && (
                  <div className="mt-3 border-t border-[var(--hairline)] pt-3">
                    {!markMarriedConfirm ? (
                      <button onClick={() => setMarkMarriedConfirm(true)} className="text-xs font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]">{t("adm_mark_married", lang)}</button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-[var(--maroon)]">{t("adm_mark_married_confirm", lang).replace("{name}", memberName || currentId)}</p>
                        <button onClick={handleMarkMarried} disabled={markMarriedSaving} className="min-h-[32px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">{t("adm_confirm_action", lang)}</button>
                        <button onClick={() => setMarkMarriedConfirm(false)} className="text-xs text-[var(--muted)]">{t("cancel", lang)}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ══════ SECTION B: SPOUSES ══════════════════════════ */}
              <div className="mb-5 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-base font-semibold text-[var(--maroon)]">{t("adm_section_spouses", lang)}</h3>
                  <button onClick={() => { setShowAddSpouse(!showAddSpouse); setAddSpouseVals({}); }} className="text-xs font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]">
                    {showAddSpouse ? t("cancel", lang) : `+ ${t("adm_add_spouse", lang)}`}
                  </button>
                </div>

                {/* Add spouse form */}
                {showAddSpouse && (
                  <div className="mb-3 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        { key: "full_name", label: "adm_field_full_name" as TranslationKey },
                        { key: "full_name_en", label: "adm_field_full_name_en" as TranslationKey },
                        { key: "gender", label: "adm_field_gender" as TranslationKey, type: "select" as const },
                        { key: "father_name", label: "adm_spouse_father_name" as TranslationKey },
                        { key: "father_name_en", label: "adm_spouse_father_name_en" as TranslationKey },
                        { key: "birth_gotra", label: "adm_spouse_birth_gotra" as TranslationKey },
                        { key: "birth_gotra_en", label: "adm_spouse_birth_gotra_en" as TranslationKey },
                        { key: "dob", label: "adm_field_dob" as TranslationKey },
                        { key: "education", label: "adm_field_education" as TranslationKey },
                        { key: "education_en", label: "adm_field_education_en" as TranslationKey },
                      ].map((f) => (
                        <div key={f.key}>
                          <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t(f.label, lang)}</label>
                          {f.type === "select" ? (
                            <select value={addSpouseVals[f.key] || ""} onChange={(e) => setAddSpouseVals((p) => ({ ...p, [f.key]: e.target.value }))} className={INPUT_CLS}>
                              <option value="">—</option>
                              <option value="M">{genderLabel("M", lang)}</option>
                              <option value="F">{genderLabel("F", lang)}</option>
                            </select>
                          ) : (
                            <input type="text" value={addSpouseVals[f.key] || ""} onChange={(e) => setAddSpouseVals((p) => ({ ...p, [f.key]: e.target.value }))} className={INPUT_CLS} />
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={handleAddSpouse} disabled={addSpouseSaving || !addSpouseVals.full_name?.trim()} className="mt-3 min-h-[36px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-4 py-1.5 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">
                      {addSpouseSaving ? t("adm_saving", lang) : t("adm_add_spouse", lang)}
                    </button>
                  </div>
                )}

                {/* Active spouses */}
                {activeSpouses.length === 0 && removedSpouses.length === 0 && !showAddSpouse && (
                  <p className="text-sm text-[var(--muted)]">—</p>
                )}
                {activeSpouses.map((sp) => (
                  <div key={sp.spouse_id} className="mb-2 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--maroon-deep)]">{bi(sp.full_name, sp.full_name_en, lang)}</p>
                        <p className="text-[11px] text-[var(--muted)]">{sp.spouse_id} · {genderLabel(sp.gender, lang)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editingSpouseId === sp.spouse_id ? setEditingSpouseId(null) : startEditSpouse(sp)} className="text-[11px] font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]">
                          {editingSpouseId === sp.spouse_id ? t("adm_close_edit", lang) : t("adm_edit_btn", lang)}
                        </button>
                        {removeSpouseConfirm === sp.spouse_id ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleRemoveSpouse(sp.spouse_id)} disabled={actionLoading} className="text-[11px] font-medium text-[var(--maroon)]">{t("adm_confirm_action", lang)}</button>
                            <button onClick={() => setRemoveSpouseConfirm(null)} className="text-[11px] text-[var(--muted)]">{t("cancel", lang)}</button>
                          </div>
                        ) : (
                          <button onClick={() => setRemoveSpouseConfirm(sp.spouse_id)} className="text-[11px] font-medium text-[var(--muted)] hover:text-[var(--maroon)]">{t("adm_remove", lang)}</button>
                        )}
                      </div>
                    </div>
                    {editingSpouseId === sp.spouse_id && (
                      <div className="mt-2 border-t border-[var(--hairline)] pt-2">
                        <div className="mb-2 flex justify-end">
                          <button
                            onClick={() => handleFillAllHindi("spouse", SPOUSE_FIELDS, spouseEdits, setSpouseEdits, () => setSpouseMsg(""))}
                            disabled={!!fillingAll || !!fillingField}
                            className="flex items-center gap-1 text-[11px] font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)] disabled:opacity-50"
                          >
                            {fillingAll === "spouse" && <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-[var(--gold)] border-t-transparent" />}
                            {t("adm_fill_all_hindi", lang)}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {SPOUSE_FIELDS.map((f) => {
                            const showFill = f.enCounterpart && String(spouseEdits[f.enCounterpart] ?? "").trim() && !String(spouseEdits[f.key] ?? "").trim();
                            return (
                              <div key={f.key}>
                                <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t(f.label, lang)}</label>
                                <FieldInput
                                  field={f}
                                  value={spouseEdits[f.key]}
                                  onChange={(v) => { setSpouseMsg(""); setSpouseEdits((p) => ({ ...p, [f.key]: v })); }}
                                  lang={lang}
                                  onFillHindi={showFill ? () => fillOneHindiField(f.key, f.enCounterpart!, spouseEdits, setSpouseEdits, () => setSpouseMsg("")) : undefined}
                                  fillBusy={fillingField === f.key}
                                  fillMsg={fillMessages[f.key]}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button onClick={handleSaveSpouse} disabled={spouseSaving} className="min-h-[32px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">
                            {spouseSaving ? t("adm_saving", lang) : t("adm_save_changes", lang)}
                          </button>
                          {spouseMsg && <p className={`text-xs ${spouseMsg === t("adm_saved", lang) ? "text-green-700" : "text-[var(--maroon)]"}`}>{spouseMsg}</p>}
                        </div>
                      </div>
                    )}
                    {/* Admin relatives — editable */}
                    <AdminRelativesBlock spouseId={sp.spouse_id} relatives={sp.relatives || []} supabase={supabase} lang={lang} onRefresh={() => fetchDetail(currentId)} />
                  </div>
                ))}

                {/* Removed spouses */}
                {removedSpouses.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("adm_removed_section", lang)} ({removedSpouses.length})</summary>
                    <div className="mt-1 space-y-1">
                      {removedSpouses.map((sp) => (
                        <div key={sp.spouse_id} className="flex items-center justify-between rounded-[var(--r-sm)] border border-dashed border-[var(--muted)]/30 bg-[var(--cream)] p-2.5 opacity-70">
                          <p className="text-xs text-[var(--muted)]">{bi(sp.full_name, sp.full_name_en, lang)}</p>
                          <button onClick={() => handleRestoreSpouse(sp.spouse_id)} disabled={actionLoading} className="text-[11px] font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)] disabled:opacity-50">{t("adm_restore", lang)}</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* ══════ SECTION C: CHILDREN ═════════════════════════ */}
              <div className="mb-5 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-base font-semibold text-[var(--maroon)]">{t("adm_section_children", lang)}</h3>
                  <button onClick={() => { setShowAddChild(!showAddChild); setAddChildVals({}); }} className="text-xs font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]">
                    {showAddChild ? t("cancel", lang) : `+ ${t("adm_add_child", lang)}`}
                  </button>
                </div>

                {/* Add child form */}
                {showAddChild && (
                  <div className="mb-3 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        { key: "full_name", label: "adm_field_full_name" as TranslationKey },
                        { key: "full_name_en", label: "adm_field_full_name_en" as TranslationKey },
                        { key: "gender", label: "adm_field_gender" as TranslationKey, type: "select" as const },
                        { key: "dob", label: "adm_field_dob" as TranslationKey },
                        { key: "education", label: "adm_field_education" as TranslationKey },
                        { key: "education_en", label: "adm_field_education_en" as TranslationKey },
                        { key: "marital_status", label: "adm_child_marital" as TranslationKey },
                      ].map((f) => (
                        <div key={f.key}>
                          <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t(f.label, lang)}</label>
                          {f.type === "select" ? (
                            <select value={addChildVals[f.key] || ""} onChange={(e) => setAddChildVals((p) => ({ ...p, [f.key]: e.target.value }))} className={INPUT_CLS}>
                              <option value="">—</option>
                              <option value="M">{genderLabel("M", lang)}</option>
                              <option value="F">{genderLabel("F", lang)}</option>
                            </select>
                          ) : (
                            <input type="text" value={addChildVals[f.key] || ""} onChange={(e) => setAddChildVals((p) => ({ ...p, [f.key]: e.target.value }))} className={INPUT_CLS} />
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={handleAddChild} disabled={addChildSaving || !addChildVals.full_name?.trim()} className="mt-3 min-h-[36px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-4 py-1.5 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">
                      {addChildSaving ? t("adm_saving", lang) : t("adm_add_child", lang)}
                    </button>
                  </div>
                )}

                {/* Active children */}
                {activeChildren.length === 0 && removedChildren.length === 0 && !showAddChild && (
                  <p className="text-sm text-[var(--muted)]">—</p>
                )}
                {activeChildren.map((ch) => {
                  const childName = bi(ch.full_name, ch.full_name_en, lang);
                  const isMarried = ch.marital_status && ch.marital_status.toLowerCase() !== "unmarried";
                  return (
                    <div key={ch.child_id} className="mb-2 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--maroon-deep)]">{childName}</p>
                          <p className="text-[11px] text-[var(--muted)]">{ch.child_id} · {genderLabel(ch.gender, lang)}{ch.marital_status ? ` · ${ch.marital_status}` : ""}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => editingChildId === ch.child_id ? setEditingChildId(null) : startEditChild(ch)} className="text-[11px] font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]">
                            {editingChildId === ch.child_id ? t("adm_close_edit", lang) : t("adm_edit_btn", lang)}
                          </button>
                          {removeChildConfirm === ch.child_id ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleRemoveChild(ch.child_id)} disabled={actionLoading} className="text-[11px] font-medium text-[var(--maroon)]">{t("adm_confirm_action", lang)}</button>
                              <button onClick={() => setRemoveChildConfirm(null)} className="text-[11px] text-[var(--muted)]">{t("cancel", lang)}</button>
                            </div>
                          ) : (
                            <button onClick={() => setRemoveChildConfirm(ch.child_id)} className="text-[11px] font-medium text-[var(--muted)] hover:text-[var(--maroon)]">{t("adm_remove", lang)}</button>
                          )}
                        </div>
                      </div>

                      {/* Inline edit */}
                      {editingChildId === ch.child_id && (
                        <div className="mt-2 border-t border-[var(--hairline)] pt-2">
                          <div className="mb-2 flex justify-end">
                            <button
                              onClick={() => handleFillAllHindi("child", CHILD_FIELDS, childEdits, setChildEdits, () => setChildMsg(""))}
                              disabled={!!fillingAll || !!fillingField}
                              className="flex items-center gap-1 text-[11px] font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)] disabled:opacity-50"
                            >
                              {fillingAll === "child" && <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-[var(--gold)] border-t-transparent" />}
                              {t("adm_fill_all_hindi", lang)}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {CHILD_FIELDS.map((f) => {
                              const showFill = f.enCounterpart && String(childEdits[f.enCounterpart] ?? "").trim() && !String(childEdits[f.key] ?? "").trim();
                              return (
                                <div key={f.key}>
                                  <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t(f.label, lang)}</label>
                                  <FieldInput
                                    field={f}
                                    value={childEdits[f.key]}
                                    onChange={(v) => { setChildMsg(""); setChildEdits((p) => ({ ...p, [f.key]: v })); }}
                                    lang={lang}
                                    onFillHindi={showFill ? () => fillOneHindiField(f.key, f.enCounterpart!, childEdits, setChildEdits, () => setChildMsg("")) : undefined}
                                    fillBusy={fillingField === f.key}
                                    fillMsg={fillMessages[f.key]}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button onClick={handleSaveChild} disabled={childSaving} className="min-h-[32px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">
                              {childSaving ? t("adm_saving", lang) : t("adm_save_changes", lang)}
                            </button>
                            {childMsg && <p className={`text-xs ${childMsg === t("adm_saved", lang) ? "text-green-700" : "text-[var(--maroon)]"}`}>{childMsg}</p>}
                          </div>
                        </div>
                      )}

                      {/* Promote / mark-married actions */}
                      {isMarried && editingChildId !== ch.child_id && (
                        <div className="mt-2 border-t border-[var(--hairline)] pt-2">
                          {promoteChildId === ch.child_id ? (
                            <div>
                              <p className="text-xs text-[var(--maroon)] mb-2">{t("adm_promote_confirm", lang).replace("{name}", childName || ch.child_id)}</p>
                              {isFemaleGender(ch.gender) && (
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-2">
                                  <div>
                                    <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("adm_husband_name_opt", lang)}</label>
                                    <input type="text" value={promoteHusbandName} onChange={(e) => setPromoteHusbandName(e.target.value)} className={INPUT_CLS} />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("adm_husband_name_en_opt", lang)}</label>
                                    <input type="text" value={promoteHusbandNameEn} onChange={(e) => setPromoteHusbandNameEn(e.target.value)} className={INPUT_CLS} />
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button onClick={handlePromoteChild} disabled={promoteSaving} className="min-h-[32px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">{t("adm_confirm_action", lang)}</button>
                                <button onClick={() => { setPromoteChildId(null); setPromoteHusbandName(""); setPromoteHusbandNameEn(""); }} className="text-xs text-[var(--muted)]">{t("cancel", lang)}</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setPromoteChildId(ch.child_id)} className="text-[11px] font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]">{t("adm_promote_to_member", lang)}</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Removed children */}
                {removedChildren.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("adm_removed_section", lang)} ({removedChildren.length})</summary>
                    <div className="mt-1 space-y-1">
                      {removedChildren.map((ch) => (
                        <div key={ch.child_id} className="flex items-center justify-between rounded-[var(--r-sm)] border border-dashed border-[var(--muted)]/30 bg-[var(--cream)] p-2.5 opacity-70">
                          <p className="text-xs text-[var(--muted)]">{bi(ch.full_name, ch.full_name_en, lang)}</p>
                          <button onClick={() => handleRestoreChild(ch.child_id)} disabled={actionLoading} className="text-[11px] font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)] disabled:opacity-50">{t("adm_restore", lang)}</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* ══════ SECTION C2: MARRIED DAUGHTERS (owned) — editable ═ */}
              <AdminMDBlock memberId={currentId} daughters={detail.married_daughters || []} supabase={supabase} lang={lang} onRefresh={() => fetchDetail(currentId)} />

              {/* ══════ SECTION C3: SASURAL (linked — daughter view) ══ */}
              {detail.sasural_details && detail.sasural_details.length > 0 && (
                <div className="mb-5 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4">
                  <h3 className="font-display text-base font-semibold text-[var(--maroon)] mb-3">{t("section_sasural" as TranslationKey, lang)}</h3>
                  {detail.sasural_details.map((d) => {
                    const dHusband = bi(d.husband_name, d.husband_name_en, lang);
                    const dSasur = bi(d.sasur_name, d.sasur_name_en, lang);
                    const dCity = bi(d.city, d.city_en, lang);
                    const dEdu = bi(d.education, d.education_en, lang);
                    const dChildNote = bi(d.children_note, d.children_note_en, lang);
                    const isRemoved = Boolean(d.removed_at);
                    return (
                      <div key={d.md_id} className={`mb-2 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-2.5 ${isRemoved ? "opacity-50" : ""}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isRemoved ? "line-through text-[var(--muted)]" : "text-[var(--maroon-deep)]"}`}>पति: {dHusband || "—"}</span>
                          {dCity && <span className="text-[11px] text-[var(--muted)]">· {dCity}</span>}
                          {d.mobile && <span className="text-[11px] text-[var(--muted)]">· {d.mobile}</span>}
                          {d.needs_review && <span className="rounded-[var(--r-pill)] bg-[rgba(201,150,46,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">समीक्षा करें / Review</span>}
                          {isRemoved && <span className="text-[10px] text-[var(--muted)]">({d.removed_at})</span>}
                        </div>
                        {dSasur && <p className="mt-0.5 text-[11px] text-[var(--muted)]">ससुर: {dSasur}</p>}
                        {dEdu && <p className="text-[11px] text-[var(--muted)]">{dEdu}</p>}
                        {d.dom && <p className="text-[11px] text-[var(--muted)]">विवाह: {d.dom}</p>}
                        {dChildNote && <p className="mt-0.5 whitespace-pre-line text-[11px] text-[var(--text-body)]">{dChildNote}</p>}
                        {d.source_raw && <p className="mt-1 font-mono text-[10px] text-[var(--muted)] break-all">{d.source_raw}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ══════ SECTION D: FAMILY BRANCH ═══════════════════ */}
              <div className="mb-5 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4">
                <h3 className="font-display text-base font-semibold text-[var(--maroon)] mb-3">{t("adm_section_tree", lang)}</h3>

                {/* Father link */}
                {detail.father && (
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">{t("adm_father_label", lang)}</p>
                    <button
                      onClick={() => navigateTo(detail.father!.member_id)}
                      className="flex items-center gap-2 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] px-3 py-2 text-left hover:bg-[var(--cream-panel)]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--gold-deep)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      <span className="text-sm font-medium text-[var(--maroon-deep)]">{bi(detail.father.full_name, detail.father.full_name_en, lang)}</span>
                      <span className="text-[11px] text-[var(--muted)]">({detail.father.member_id})</span>
                    </button>
                  </div>
                )}

                {/* Tree children */}
                {detail.tree_children.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">{t("adm_tree_children_label", lang)}</p>
                    <div className="space-y-1">
                      {detail.tree_children.map((tc) => (
                        <TreeChildNode
                          key={tc.member_id}
                          node={tc}
                          expanded={expandedNodes.has(tc.member_id)}
                          subChildren={subChildren[tc.member_id]}
                          onToggle={() => toggleTreeExpand(tc.member_id)}
                          onNavigate={navigateTo}
                          lang={lang}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {!detail.father && detail.tree_children.length === 0 && (
                  <p className="text-sm text-[var(--muted)]">—</p>
                )}
              </div>

              {/* ══════ SECTION E: HISTORY ══════════════════════════ */}
              <div className="mb-5">
                <h3 className="font-display text-base font-semibold text-[var(--maroon)] mb-2">{t("adm_history", lang)}</h3>
                {detail.history.length === 0 && detail.admin_actions.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">{t("adm_no_history", lang)}</p>
                ) : (
                  <div className="space-y-2">
                    {detail.history.map((h, i) => (
                      <div key={`h-${i}`} className="rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-2.5">
                        <p className="text-xs text-[var(--muted)]">{relativeTime(h.changed_at, lang)}{h.changed_by && <> &middot; {h.changed_by}</>}</p>
                        {h.previous_values && <p className="mt-1 text-xs text-[var(--maroon-deep)]">{t("adm_changed_fields", lang)}: {Object.keys(h.previous_values).join(", ")}</p>}
                      </div>
                    ))}
                    {detail.admin_actions.length > 0 && (
                      <>
                        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--gold-deep)]">{t("adm_admin_actions", lang)}</p>
                        {detail.admin_actions.map((a, i) => (
                          <div key={`a-${i}`} className="rounded-[var(--r-sm)] border border-[var(--maroon)]/20 bg-[rgba(110,30,42,0.04)] p-2.5">
                            <p className="text-xs text-[var(--muted)]">{relativeTime(a.at, lang)}{a.actor && <> &middot; {a.actor}</>}</p>
                            <p className="mt-0.5 text-xs font-medium text-[var(--maroon)]">{a.action}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ══════ SECTION F: DANGER ZONE ═════════════════════ */}
              <div className="mb-2">
                <button onClick={() => setDangerOpen(!dangerOpen)} className="flex w-full items-center justify-between rounded-[var(--r-sm)] border-2 border-[var(--maroon)]/30 px-4 py-2.5 text-sm font-semibold text-[var(--maroon)] hover:bg-[rgba(110,30,42,0.04)]">
                  {t("adm_danger_zone", lang)}
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 motion-safe:transition-transform motion-safe:duration-[var(--dur-fast)] ${dangerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {dangerOpen && (
                  <div className="mt-2 space-y-3 rounded-[var(--r-sm)] border-2 border-[var(--maroon)]/30 p-4">
                    {dangerMsg && <p className="rounded-[var(--r-sm)] bg-[rgba(110,30,42,0.06)] px-3 py-2 text-sm font-medium text-[var(--maroon)]">{dangerMsg}</p>}

                    {detail.family.claimed && (
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--maroon)]">{t("adm_unlink_claim", lang)}</h4>
                        <p className="text-xs text-[var(--muted)] mt-0.5">{t("adm_unlink_claim_desc", lang)}</p>
                        {!unlinkConfirm ? (
                          <button onClick={() => setUnlinkConfirm(true)} className="mt-2 min-h-[36px] rounded-[var(--r-sm)] border border-[var(--maroon)] px-4 py-1.5 text-xs font-medium text-[var(--maroon)] hover:bg-[rgba(110,30,42,0.06)]">{t("adm_unlink_claim", lang)}</button>
                        ) : (
                          <div className="mt-2 flex items-center gap-2">
                            <p className="text-xs text-[var(--maroon)]">{t("adm_unlink_confirm", lang)}</p>
                            <button onClick={handleUnlink} disabled={dangerLoading} className="min-h-[32px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">{t("adm_confirm_action", lang)}</button>
                            <button onClick={() => setUnlinkConfirm(false)} className="text-xs text-[var(--muted)]">{t("cancel", lang)}</button>
                          </div>
                        )}
                      </div>
                    )}

                    {detail.family.claim_user_id && (
                      <div className="border-t border-[var(--maroon)]/15 pt-3">
                        <h4 className="text-sm font-semibold text-[var(--maroon)]">{t("adm_delete_auth", lang)}</h4>
                        <p className="text-xs text-[var(--muted)] mt-0.5">{t("adm_delete_auth_desc", lang)}</p>
                        {!deleteAuthConfirm ? (
                          <button onClick={() => setDeleteAuthConfirm(true)} className="mt-2 min-h-[36px] rounded-[var(--r-sm)] border border-[var(--maroon)] px-4 py-1.5 text-xs font-medium text-[var(--maroon)] hover:bg-[rgba(110,30,42,0.06)]">{t("adm_delete_auth", lang)}</button>
                        ) : (
                          <div className="mt-2">
                            <p className="text-xs text-[var(--maroon)]">{t("adm_delete_auth_confirm", lang)} <span className="font-semibold">{detail.family.claim_email}</span>?</p>
                            <div className="mt-2 flex items-center gap-2">
                              <button onClick={handleDeleteAuth} disabled={dangerLoading} className="min-h-[32px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">{t("adm_confirm_action", lang)}</button>
                              <button onClick={() => setDeleteAuthConfirm(false)} className="text-xs text-[var(--muted)]">{t("cancel", lang)}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="border-t border-[var(--maroon)]/15 pt-3">
                      <h4 className="text-sm font-semibold text-[var(--maroon)]">{t("adm_cascade_delete", lang)}</h4>
                      <p className="text-xs text-[var(--muted)] mt-0.5">{t("adm_cascade_delete_desc", lang)}</p>
                      <p className="mt-2 rounded-[var(--r-sm)] bg-[rgba(110,30,42,0.06)] px-3 py-2 text-xs text-[var(--maroon)]">{t("adm_cascade_warning", lang).replace("{count}", String(detail.descendant_count))}</p>
                      <div className="mt-2">
                        <label className="text-xs font-medium text-[var(--maroon)]">{t("adm_cascade_type_id", lang)}</label>
                        <input type="text" value={cascadeInput} onChange={(e) => setCascadeInput(e.target.value)} placeholder={currentId} className={`${INPUT_CLS} mt-1`} />
                      </div>
                      <button onClick={handleCascadeDelete} disabled={dangerLoading || cascadeInput.trim() !== currentId} className="mt-2 min-h-[36px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-4 py-1.5 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">{t("adm_cascade_delete", lang)}</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .motion-safe\\:animate-\\[fadeIn_200ms_ease-out\\],
          .motion-safe\\:animate-\\[slideUp_250ms_ease-out\\] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Tree child node (recursive-expandable)
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   Admin Relatives Block (spouse relatives — edit/add/remove)
   ═══════════════════════════════════════════════════════════════════════ */

function AdminRelativesBlock({ spouseId, relatives, supabase, lang, onRefresh }: {
  spouseId: string; relatives: SpouseRelative[]; supabase: SupabaseClient; lang: Lang; onRefresh: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [editOrig, setEditOrig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addVals, setAddVals] = useState<Record<string, string>>({});
  const [removeId, setRemoveId] = useState<string | null>(null);

  const active = relatives.filter((r) => !r.removed_at);
  const removed = relatives.filter((r) => r.removed_at);

  function startEdit(r: SpouseRelative) {
    const vals = initFormVals(r as unknown as Record<string, unknown>, RELATIVE_EDIT_KEYS);
    setEditVals(vals);
    setEditOrig({ ...vals });
    setEditId(r.relative_id);
    setErrMsg("");
  }

  async function handleSave() {
    if (!editId) return;
    const dirty = dirtyDiff(editVals, editOrig);
    if (Object.keys(dirty).length === 0) { setEditId(null); return; }
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_spouse_relative", { p_relative_id: editId, p_fields: dirty });
    if (error) { setErrMsg(error.message); setSaving(false); return; }
    setEditId(null); setSaving(false); onRefresh();
  }

  async function handleAdd() {
    setSaving(true);
    const { error } = await supabase.rpc("add_spouse_relative", {
      p_spouse_id: spouseId,
      p_relation_code: addVals.relation_code || "other",
      p_relation_label: addVals.relation_label || null,
      p_relation_label_en: addVals.relation_label_en || null,
      p_full_name: addVals.full_name || null,
      p_full_name_en: addVals.full_name_en || null,
      p_addr: addVals.addr || null, p_addr_en: addVals.addr_en || null,
      p_city: addVals.city || null, p_city_en: addVals.city_en || null,
      p_mobile: addVals.mobile || null,
      p_occupation: addVals.occupation || null, p_occupation_en: addVals.occupation_en || null,
      p_notes: addVals.notes || null, p_notes_en: addVals.notes_en || null,
    });
    if (error) { setErrMsg(error.message); setSaving(false); return; }
    setShowAdd(false); setAddVals({}); setSaving(false); onRefresh();
  }

  async function handleRemove(id: string) {
    await supabase.rpc("delete_spouse_relative", { p_relative_id: id });
    setRemoveId(null); onRefresh();
  }

  async function handleRestore(id: string) {
    await supabase.rpc("restore_spouse_relative", { p_relative_id: id });
    onRefresh();
  }

  if (active.length === 0 && removed.length === 0 && !showAdd) {
    return (
      <div className="mt-2 border-t border-[var(--hairline)] pt-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("section_wife_family" as TranslationKey, lang)}</p>
          <button onClick={() => { setShowAdd(true); setAddVals({}); setErrMsg(""); }} className="text-[11px] font-medium text-[var(--gold-deep)]">+ {t("add_relative" as TranslationKey, lang)}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 border-t border-[var(--hairline)] pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("section_wife_family" as TranslationKey, lang)}</p>
        <button onClick={() => { setShowAdd(!showAdd); setAddVals({}); setErrMsg(""); }} className="text-[11px] font-medium text-[var(--gold-deep)]">{showAdd ? t("cancel", lang) : `+ ${t("add_relative" as TranslationKey, lang)}`}</button>
      </div>
      {showAdd && (
        <div className="mb-2 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-white p-2 space-y-1.5">
          {RELATIVE_EDIT_KEYS.map((k) => (
            <div key={k}><label className="block text-[10px] text-[var(--muted)]">{k}</label><input type="text" value={addVals[k] || ""} onChange={(e) => setAddVals((p) => ({ ...p, [k]: e.target.value }))} className={INPUT_CLS + " !min-h-[32px] !text-xs"} /></div>
          ))}
          {errMsg && <p className="text-[11px] text-[var(--maroon)]">{errMsg}</p>}
          <button onClick={handleAdd} disabled={saving} className="min-h-[28px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-[11px] font-medium text-[var(--ivory)] disabled:opacity-50">{saving ? "…" : t("add_relative" as TranslationKey, lang)}</button>
        </div>
      )}
      {active.map((r) => {
        const rName = bi(r.full_name, r.full_name_en, lang);
        const rLabel = bi(r.relation_label, r.relation_label_en, lang) || "—";
        return (
          <div key={r.relative_id} className="mb-1 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-white p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><span className="text-xs font-medium text-[var(--gold-deep)]">{rLabel}</span><span className="text-sm text-[var(--maroon-deep)]">{rName || "—"}</span></div>
              <div className="flex gap-1.5">
                <button onClick={() => editId === r.relative_id ? setEditId(null) : startEdit(r)} className="text-[11px] text-[var(--gold-deep)]">{editId === r.relative_id ? t("adm_close_edit", lang) : t("adm_edit_btn", lang)}</button>
                {removeId === r.relative_id ? (
                  <><button onClick={() => handleRemove(r.relative_id)} className="text-[11px] text-[var(--maroon)]">{t("adm_confirm_action", lang)}</button><button onClick={() => setRemoveId(null)} className="text-[11px] text-[var(--muted)]">{t("cancel", lang)}</button></>
                ) : (
                  <button onClick={() => setRemoveId(r.relative_id)} className="text-[11px] text-[var(--muted)]">✕</button>
                )}
              </div>
            </div>
            {editId === r.relative_id && (
              <div className="mt-1.5 border-t border-[var(--hairline)] pt-1.5 grid grid-cols-2 gap-1.5">
                {RELATIVE_EDIT_KEYS.map((k) => (
                  <div key={k}><label className="block text-[10px] text-[var(--muted)]">{k}</label><input type="text" value={editVals[k] || ""} onChange={(e) => { setErrMsg(""); setEditVals((p) => ({ ...p, [k]: e.target.value })); }} className={INPUT_CLS + " !min-h-[32px] !text-xs"} /></div>
                ))}
                {errMsg && <p className="col-span-2 text-[11px] text-[var(--maroon)]">{errMsg}</p>}
                <button onClick={handleSave} disabled={saving} className="col-span-2 min-h-[28px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-[11px] font-medium text-[var(--ivory)] disabled:opacity-50">{saving ? t("adm_saving", lang) : t("adm_save_changes", lang)}</button>
              </div>
            )}
          </div>
        );
      })}
      {removed.length > 0 && (
        <details className="mt-1"><summary className="cursor-pointer text-[10px] text-[var(--muted)]">{t("adm_removed_section", lang)} ({removed.length})</summary>
          {removed.map((r) => (
            <div key={r.relative_id} className="mt-1 flex items-center justify-between rounded-[var(--r-sm)] border border-dashed border-[var(--muted)]/30 bg-white p-1.5 opacity-60">
              <span className="text-[11px] text-[var(--muted)]">{bi(r.full_name, r.full_name_en, lang) || "—"}</span>
              <button onClick={() => handleRestore(r.relative_id)} className="text-[11px] text-[var(--gold-deep)]">{t("adm_restore", lang)}</button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Admin MD Block (married daughters — edit/add/remove)
   ═══════════════════════════════════════════════════════════════════════ */

function AdminMDBlock({ memberId, daughters, supabase, lang, onRefresh }: {
  memberId: string; daughters: MarriedDaughter[]; supabase: SupabaseClient; lang: Lang; onRefresh: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [editOrig, setEditOrig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addVals, setAddVals] = useState<Record<string, string>>({});
  const [removeId, setRemoveId] = useState<string | null>(null);

  const active = daughters.filter((d) => !d.removed_at);
  const removed = daughters.filter((d) => d.removed_at);

  function startEdit(d: MarriedDaughter) {
    const rec = d as unknown as Record<string, unknown>;
    const vals: Record<string, string> = {};
    for (const k of MD_EDIT_KEYS) {
      if (k === "needs_review") vals[k] = rec[k] ? "true" : "false";
      else vals[k] = String(rec[k] ?? "");
    }
    setEditVals(vals);
    setEditOrig({ ...vals });
    setEditId(d.md_id);
    setErrMsg("");
  }

  async function handleSave() {
    if (!editId) return;
    const dirty: Record<string, unknown> = {};
    for (const k of Object.keys(editVals)) {
      const newVal = editVals[k]?.trim() ?? "";
      const origVal = editOrig[k]?.trim() ?? "";
      if (newVal !== origVal) {
        if (k === "needs_review") dirty[k] = newVal === "true";
        else dirty[k] = newVal || null;
      }
    }
    if (Object.keys(dirty).length === 0) { setEditId(null); return; }
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_married_daughter", { p_md_id: editId, p_fields: dirty });
    if (error) { setErrMsg(error.message); setSaving(false); return; }
    setEditId(null); setSaving(false); onRefresh();
  }

  async function handleAdd() {
    setSaving(true);
    const fields: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(addVals)) {
      if (k === "needs_review") continue;
      if (v.trim()) fields[k] = v.trim();
    }
    if (!fields.relation_label) { fields.relation_label = "बेटी/बहन"; fields.relation_label_en = "Daughter/Sister"; }
    const { error } = await supabase.rpc("add_married_daughter", { p_member_id: memberId, p_fields: fields });
    if (error) { setErrMsg(error.message); setSaving(false); return; }
    setShowAdd(false); setAddVals({}); setSaving(false); onRefresh();
  }

  async function handleRemove(id: string) {
    await supabase.rpc("delete_married_daughter", { p_md_id: id });
    setRemoveId(null); onRefresh();
  }

  if (active.length === 0 && removed.length === 0 && !showAdd) {
    return (
      <div className="mb-5 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-[var(--maroon)]">बेटी / बहन — Married daughters</h3>
          <button onClick={() => { setShowAdd(true); setAddVals({}); setErrMsg(""); }} className="text-[11px] font-medium text-[var(--gold-deep)]">+ {t("adm_add_md", lang)}</button>
        </div>
      </div>
    );
  }

  const addKeys = MD_EDIT_KEYS.filter((k) => k !== "needs_review");

  return (
    <div className="mb-5 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-base font-semibold text-[var(--maroon)]">बेटी / बहन — Married daughters</h3>
        <button onClick={() => { setShowAdd(!showAdd); setAddVals({}); setErrMsg(""); }} className="text-[11px] font-medium text-[var(--gold-deep)]">{showAdd ? t("cancel", lang) : `+ ${t("adm_add_md", lang)}`}</button>
      </div>
      {showAdd && (
        <div className="mb-2 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-2.5 grid grid-cols-2 gap-1.5">
          {addKeys.map((k) => (
            <div key={k}><label className="block text-[10px] text-[var(--muted)]">{k}</label><input type="text" value={addVals[k] || ""} onChange={(e) => setAddVals((p) => ({ ...p, [k]: e.target.value }))} className={INPUT_CLS + " !min-h-[32px] !text-xs"} /></div>
          ))}
          {errMsg && <p className="col-span-2 text-[11px] text-[var(--maroon)]">{errMsg}</p>}
          <button onClick={handleAdd} disabled={saving} className="col-span-2 min-h-[28px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-[11px] font-medium text-[var(--ivory)] disabled:opacity-50">{saving ? "…" : t("adm_add_md", lang)}</button>
        </div>
      )}
      {active.map((d) => {
        const dName = bi(d.full_name, d.full_name_en, lang);
        const dHusband = bi(d.husband_name, d.husband_name_en, lang);
        const dCity = bi(d.city, d.city_en, lang);
        return (
          <div key={d.md_id} className="mb-2 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[var(--maroon-deep)]">{dName || "—"}</span>
                {d.d_member_id && <a href={`/family/${d.d_member_id}`} className="rounded-[var(--r-pill)] bg-[rgba(201,150,46,0.12)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--gold-deep)] hover:underline">{d.d_member_id}</a>}
                {dHusband && <span className="text-[11px] text-[var(--muted)]">· पति: {dHusband}</span>}
                {dCity && <span className="text-[11px] text-[var(--muted)]">· {dCity}</span>}
                {d.needs_review && <span className="rounded-[var(--r-pill)] bg-[rgba(201,150,46,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">Review</span>}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => editId === d.md_id ? setEditId(null) : startEdit(d)} className="text-[11px] text-[var(--gold-deep)]">{editId === d.md_id ? t("adm_close_edit", lang) : t("adm_edit_btn", lang)}</button>
                {removeId === d.md_id ? (
                  <><button onClick={() => handleRemove(d.md_id)} className="text-[11px] text-[var(--maroon)]">{t("adm_confirm_action", lang)}</button><button onClick={() => setRemoveId(null)} className="text-[11px] text-[var(--muted)]">{t("cancel", lang)}</button></>
                ) : (
                  <button onClick={() => setRemoveId(d.md_id)} className="text-[11px] text-[var(--muted)]">✕</button>
                )}
              </div>
            </div>
            {editId === d.md_id && (
              <div className="mt-1.5 border-t border-[var(--hairline)] pt-1.5 grid grid-cols-2 gap-1.5">
                {MD_EDIT_KEYS.map((k) => (
                  k === "needs_review" ? (
                    <div key={k} className="col-span-2 flex items-center gap-2">
                      <label className="text-[10px] text-[var(--muted)]">{t("adm_needs_review", lang)}</label>
                      <input type="checkbox" checked={editVals[k] === "true"} onChange={(e) => setEditVals((p) => ({ ...p, [k]: e.target.checked ? "true" : "false" }))} className="h-3.5 w-3.5" />
                    </div>
                  ) : (
                    <div key={k}><label className="block text-[10px] text-[var(--muted)]">{k}</label><input type="text" value={editVals[k] || ""} onChange={(e) => { setErrMsg(""); setEditVals((p) => ({ ...p, [k]: e.target.value })); }} className={INPUT_CLS + " !min-h-[32px] !text-xs"} /></div>
                  )
                ))}
                {errMsg && <p className="col-span-2 text-[11px] text-[var(--maroon)]">{errMsg}</p>}
                <button onClick={handleSave} disabled={saving} className="col-span-2 min-h-[28px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-[11px] font-medium text-[var(--ivory)] disabled:opacity-50">{saving ? t("adm_saving", lang) : t("adm_save_changes", lang)}</button>
                {d.source_raw && <p className="col-span-2 font-mono text-[10px] text-[var(--muted)] break-all">{d.source_raw}</p>}
              </div>
            )}
          </div>
        );
      })}
      {removed.length > 0 && (
        <details className="mt-2"><summary className="cursor-pointer text-[10px] text-[var(--muted)]">{t("adm_removed_section", lang)} ({removed.length})</summary>
          {removed.map((d) => (
            <div key={d.md_id} className="mt-1 flex items-center justify-between rounded-[var(--r-sm)] border border-dashed border-[var(--muted)]/30 bg-[var(--cream)] p-1.5 opacity-60">
              <span className="text-[11px] line-through text-[var(--muted)]">{bi(d.full_name, d.full_name_en, lang) || "—"} <span className="text-[9px]">({d.removed_at})</span></span>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function TreeChildNode({
  node,
  expanded,
  subChildren,
  onToggle,
  onNavigate,
  lang,
}: {
  node: TreeChild;
  expanded: boolean;
  subChildren: TreeChild[] | undefined;
  onToggle: () => void;
  onNavigate: (id: string) => void;
  lang: Lang;
}) {
  const name = bi(node.full_name, node.full_name_en, lang);
  return (
    <div>
      <div className="flex items-center gap-2 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] px-3 py-2">
        {/* Expand chevron */}
        {node.has_descendants ? (
          <button onClick={onToggle} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--gold-deep)] hover:bg-[var(--cream-panel)]">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 motion-safe:transition-transform motion-safe:duration-[var(--dur-fast)] ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-6" />
        )}
        {/* Name (clickable → navigate) */}
        <button onClick={() => onNavigate(node.member_id)} className="min-w-0 flex-1 text-left">
          <span className="text-sm font-medium text-[var(--maroon-deep)] hover:underline">{name}</span>
          <span className="ml-1.5 text-[11px] text-[var(--muted)]">({node.member_id})</span>
        </button>
        {/* Badges */}
        <div className="flex shrink-0 gap-1">
          {node.claimed && (
            <span className="rounded-[var(--r-pill)] bg-[rgba(201,150,46,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--gold-deep)]">
              {lang === "en" ? "Claimed" : "जुड़ा"}
            </span>
          )}
          {node.is_deceased && (
            <span className="rounded-[var(--r-pill)] bg-[rgba(42,14,18,0.08)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--ink)]">
              {lang === "en" ? "Deceased" : "दिवंगत"}
            </span>
          )}
        </div>
      </div>
      {/* Sub-children when expanded */}
      {expanded && (
        <div className="ml-6 mt-1 space-y-1 border-l-2 border-[var(--gold)]/30 pl-2">
          {!subChildren ? (
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--cream-panel)]" />
          ) : subChildren.length === 0 ? (
            <p className="text-[11px] text-[var(--muted)]">—</p>
          ) : (
            subChildren.map((sc) => (
              <TreeChildNode
                key={sc.member_id}
                node={sc}
                expanded={false}
                subChildren={undefined}
                onToggle={() => onNavigate(sc.member_id)}
                onNavigate={onNavigate}
                lang={lang}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
