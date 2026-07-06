"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Member, Spouse, Child, type SpouseRelative } from "@/lib/types";
import { useLang } from "@/lib/language-context";
import { t, type Lang } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import { createClient } from "@/lib/supabase/client";
import { useAutoHindi, sweepAutoHindi, transliteratePhrase } from "@/lib/transliterate";
import { validateImage, uploadPhoto, createPreviewUrl } from "@/lib/photo-utils";
import LanguageToggle from "@/app/language-toggle";
import BottomNav from "@/app/bottom-nav";
import { FadeIn } from "@/components/Motion";
import GotraSelect from "@/components/form/GotraSelect";
import CountryStateCity from "@/components/form/CountryStateCity";
import DateField from "@/components/form/DateField";
import PhoneField from "@/components/form/PhoneField";
import InitialsAvatar from "@/components/form/InitialsAvatar";

// ── Helpers ─────────────────────────────────────────────────────────────────

type LineageMember = Pick<
  Member,
  "member_id" | "full_name" | "full_name_en" | "is_deceased"
>;

type MemberChild = Pick<
  Member,
  "member_id" | "full_name" | "full_name_en" | "gender" | "dob" | "marital_status" | "photo_url" | "is_deceased"
>;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 mb-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {children}
      </h2>
    </div>
  );
}

// ── Photo Avatar ────────────────────────────────────────────────────────────

function PhotoAvatar({
  photoUrl,
  previewUrl,
  fallbackInitial,
  editing,
  onFileSelect,
  onRemove,
  size = "lg",
}: {
  photoUrl: string | null;
  previewUrl: string | null;
  fallbackInitial: string;
  editing: boolean;
  onFileSelect?: (file: File) => void;
  onRemove?: () => void;
  size?: "lg" | "sm";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const src = previewUrl || photoUrl;
  const dim = size === "lg" ? "h-[88px] w-[88px] text-3xl" : "h-10 w-10 text-lg";

  function handleClick() {
    if (editing && fileRef.current) fileRef.current.click();
  }

  return (
    <div className="relative shrink-0">
      {src ? (
        <img
          src={src}
          alt=""
          className={`${dim} rounded-full object-cover border-[1.5px] border-[var(--gold)] ${editing ? "cursor-pointer ring-2 ring-[var(--gold)] ring-offset-1" : ""}`}
          onClick={handleClick}
        />
      ) : (
        <div
          className={`flex ${dim} items-center justify-center rounded-full bg-[var(--cream-panel)] font-display font-bold text-[var(--maroon)] border-[1.5px] border-[var(--gold)] ${editing ? "cursor-pointer ring-2 ring-[var(--gold)] ring-offset-1" : ""}`}
          onClick={handleClick}
        >
          {fallbackInitial}
        </div>
      )}
      {editing && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && onFileSelect) onFileSelect(f);
              e.target.value = "";
            }}
          />
          {src && onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs text-white shadow" style={{ background: "rgba(110,30,42,0.8)" }}
              type="button"
            >
              ×
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── View-mode row ───────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--hairline)] py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-[var(--muted)]">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-[var(--maroon-deep)]">
        {value}
      </span>
    </div>
  );
}

// ── Edit-mode row ───────────────────────────────────────────────────────────

function EditRow({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "tel" | "date";
}) {
  return (
    <div className="border-b border-[var(--hairline)] py-2 last:border-0">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
      />
    </div>
  );
}

/**
 * Wraps EditRow for bilingual fields: when lang=en, silently auto-fills the
 * Hindi counterpart via transliteration (debounced, non-blocking).
 * Shows a subtle shimmer in the Hindi field while filling.
 */
function AutoHindiEditRow({
  label,
  lang,
  englishValue,
  hindiValue,
  onChangeActive,
  setHindi,
}: {
  label: string;
  lang: Lang;
  englishValue: string;
  hindiValue: string;
  onChangeActive: (v: string) => void;
  setHindi: (v: string) => void;
}) {
  const [filling, setFilling] = useState(false);

  // Only activate hook when lang=en (typing English, auto-fill Hindi)
  const { onBlurEnglish } = useAutoHindi(
    lang === "en" ? englishValue : "",
    hindiValue,
    setHindi,
    setFilling,
  );

  const activeValue = lang === "en" ? englishValue : hindiValue;

  return (
    <div className="border-b border-[var(--hairline)] py-2 last:border-0">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={activeValue}
          onChange={(e) => onChangeActive(e.target.value)}
          onBlur={lang === "en" ? onBlurEnglish : undefined}
          className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
        />
        {filling && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--gold)] animate-pulse">···</span>
        )}
      </div>
    </div>
  );
}

// ── Edit state types ────────────────────────────────────────────────────────

interface MemberEdits {
  full_name: string;
  full_name_en: string;
  education: string;
  education_en: string;
  occupation: string;
  occupation_en: string;
  dob: string;
  mobile_1: string;
  mobile_2: string;
  email: string;
  addr_line1: string;
  addr_line1_en: string;
  addr_line2: string;
  addr_line2_en: string;
  city: string;
  city_en: string;
  pincode: string;
  gotra: string;
  gotra_en: string;
  husband_name: string;
  husband_name_en: string;
  marital_status: string;
  country: string;
  country_en: string;
  state: string;
  state_en: string;
  notes: string;
  notes_en: string;
}

interface SpouseEdits {
  spouse_id: string;
  full_name: string;
  full_name_en: string;
  birth_gotra: string;
  birth_gotra_en: string;
  father_name: string;
  father_name_en: string;
  education: string;
  education_en: string;
  dob: string;
  date_of_marriage: string;
  mobile: string;
  email: string;
  notes: string;
  notes_en: string;
}

interface ChildEdits {
  child_id: string;
  full_name: string;
  full_name_en: string;
  gender: string;
  dob: string;
  education: string;
  education_en: string;
  occupation: string;
  occupation_en: string;
  mobile: string;
  email: string;
  notes: string;
  notes_en: string;
}

function memberToEdits(m: Member): MemberEdits {
  return {
    full_name: m.full_name || "",
    full_name_en: m.full_name_en || "",
    education: m.education || "",
    education_en: m.education_en || "",
    occupation: m.occupation || "",
    occupation_en: m.occupation_en || "",
    dob: m.dob || "",
    mobile_1: m.mobile_1 || "",
    mobile_2: m.mobile_2 || "",
    email: m.email || "",
    addr_line1: m.addr_line1 || "",
    addr_line1_en: m.addr_line1_en || "",
    addr_line2: m.addr_line2 || "",
    addr_line2_en: m.addr_line2_en || "",
    city: m.city || "",
    city_en: m.city_en || "",
    pincode: m.pincode || "",
    gotra: m.gotra || "",
    gotra_en: m.gotra_en || "",
    husband_name: m.husband_name || "",
    husband_name_en: m.husband_name_en || "",
    marital_status: m.marital_status || "",
    country: m.country || "",
    country_en: m.country_en || "",
    state: m.state || "",
    state_en: m.state_en || "",
    notes: m.notes || "",
    notes_en: m.notes_en || "",
  };
}

function spouseToEdits(s: Spouse): SpouseEdits {
  return {
    spouse_id: s.spouse_id,
    full_name: s.full_name || "",
    full_name_en: s.full_name_en || "",
    birth_gotra: s.birth_gotra || "",
    birth_gotra_en: s.birth_gotra_en || "",
    father_name: s.father_name || "",
    father_name_en: s.father_name_en || "",
    education: s.education || "",
    education_en: s.education_en || "",
    dob: s.dob || "",
    date_of_marriage: s.date_of_marriage || "",
    mobile: s.mobile || "",
    email: s.email || "",
    notes: s.notes || "",
    notes_en: s.notes_en || "",
  };
}

function childToEdits(c: Child): ChildEdits {
  return {
    child_id: c.child_id,
    full_name: c.full_name || "",
    full_name_en: c.full_name_en || "",
    gender: c.gender || "",
    dob: c.dob || "",
    education: c.education || "",
    education_en: c.education_en || "",
    occupation: c.occupation || "",
    occupation_en: c.occupation_en || "",
    mobile: c.mobile || "",
    email: c.email || "",
    notes: c.notes || "",
    notes_en: c.notes_en || "",
  };
}

/** Get the active-language field key and the other-language key */
function langKeys(
  baseField: string,
  lang: Lang
): { activeKey: string; otherKey: string } {
  if (lang === "en") {
    return { activeKey: `${baseField}_en`, otherKey: baseField };
  }
  return { activeKey: baseField, otherKey: `${baseField}_en` };
}

/** Set edit value for active language, auto-fill other if empty.
 *  When lang=en, we skip the Hindi auto-copy — useAutoHindi handles transliteration.
 *  When lang=hi, we still copy verbatim to the _en field if it's empty. */
function setEditVal(
  edits: Record<string, string>,
  baseField: string,
  lang: Lang,
  value: string
): Record<string, string> {
  const { activeKey, otherKey } = langKeys(baseField, lang);
  const updated = { ...edits, [activeKey]: value };
  // When user types in Hindi (lang=hi), copy to English if empty
  // When user types in English (lang=en), do NOT copy to Hindi — transliteration hook handles it
  if (lang === "hi" && !edits[otherKey]) {
    updated[otherKey] = value;
  }
  return updated;
}

// ── Build update payload: only changed bilingual fields ─────────────────────

function buildBilingualPayload(
  edits: Record<string, string>,
  original: Record<string, string | null>,
  bilingualFields: string[],
  plainFields: string[]
): Record<string, string | null> {
  const payload: Record<string, string | null> = {};

  for (const field of bilingualFields) {
    const hiKey = field;
    const enKey = `${field}_en`;
    const hiVal = edits[hiKey] || null;
    const enVal = edits[enKey] || null;
    if (hiVal !== (original[hiKey] ?? null)) payload[hiKey] = hiVal;
    if (enVal !== (original[enKey] ?? null)) payload[enKey] = enVal;
  }

  for (const field of plainFields) {
    const val = edits[field] || null;
    if (val !== (original[field] ?? null)) payload[field] = val;
  }

  return payload;
}

// ── Relation code/label mapping ─────────────────────────────────────────────

const RELATION_OPTIONS = [
  { code: "sasur", hi: "ससुर", en: "Father-in-law" },
  { code: "sas", hi: "सास", en: "Mother-in-law" },
  { code: "sala", hi: "साला", en: "Brother-in-law" },
  { code: "sali", hi: "साली", en: "Sister-in-law" },
  { code: "chacher_sasur", hi: "चचेर ससुर", en: "Father-in-law's cousin" },
  { code: "bahnoi", hi: "बहनोई", en: "Sister's husband" },
  { code: "mother", hi: "माता", en: "Mother" },
  { code: "father", hi: "पिता", en: "Father" },
  { code: "brother", hi: "भाई", en: "Brother" },
  { code: "sister", hi: "बहन", en: "Sister" },
  { code: "other", hi: "अन्य", en: "Other" },
] as const;

// Preferred group ordering for display
const RELATION_SORT_ORDER: Record<string, number> = { "ससुर": 0, "सास": 1, "साला": 2, "साली": 3 };

function groupRelatives(relatives: SpouseRelative[], lang: Lang) {
  const groups = new Map<string, SpouseRelative[]>();
  for (const r of relatives) {
    const label = bi(r.relation_label, r.relation_label_en, lang) || (lang === "en" ? "Other" : "अन्य");
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(r);
  }
  // Sort groups by preferred order, then alphabetical
  return Array.from(groups.entries()).sort(([a], [b]) => {
    const oa = RELATION_SORT_ORDER[a] ?? 99;
    const ob = RELATION_SORT_ORDER[b] ?? 99;
    return oa !== ob ? oa - ob : a.localeCompare(b);
  });
}

function renderMobiles(mobile: string | null) {
  if (!mobile) return null;
  const numbers = mobile.split("/").map((n) => n.trim()).filter(Boolean);
  return (
    <span className="flex flex-wrap gap-2">
      {numbers.map((num, i) => (
        <a key={i} href={`tel:${num}`} className="text-[var(--gold-deep)] underline underline-offset-2 hover:text-[var(--maroon)]">
          {num}
        </a>
      ))}
    </span>
  );
}

// ── Spouse relatives editor ─────────────────────────────────────────────────

const INPUT_CLS_REL = "min-h-[40px] w-full rounded-[var(--r-sm)] border border-[#ECE0C8] bg-white px-3 py-1.5 text-sm text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none";

function RelationDropdown({
  value, onChange, vals, setter, lang,
}: {
  value: string;
  onChange: (code: string) => void;
  vals: Record<string, string>;
  setter: (fn: (p: Record<string, string>) => Record<string, string>) => void;
  lang: Lang;
}) {
  function setFromCode(code: string) {
    const opt = RELATION_OPTIONS.find((o) => o.code === code);
    setter((p) => ({
      ...p,
      relation_code: code,
      relation_label: opt ? opt.hi : p.relation_label || "",
      relation_label_en: opt ? opt.en : p.relation_label_en || "",
    }));
  }
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("label_relation", lang)}</label>
      <select value={value} onChange={(e) => { onChange(e.target.value); setFromCode(e.target.value); }} className={INPUT_CLS_REL}>
        <option value="">— {t("label_relation", lang)} —</option>
        {RELATION_OPTIONS.map((o) => <option key={o.code} value={o.code}>{lang === "en" ? `${o.en} (${o.hi})` : `${o.hi} (${o.en})`}</option>)}
      </select>
      {value === "other" && (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <input type="text" placeholder={lang === "en" ? "Label (Hindi)" : "नाम (हिंदी)"} value={vals.relation_label || ""} onChange={(e) => setter((p) => ({ ...p, relation_label: e.target.value }))} className={INPUT_CLS_REL} />
          <input type="text" placeholder={lang === "en" ? "Label (English)" : "नाम (अंग्रेज़ी)"} value={vals.relation_label_en || ""} onChange={(e) => setter((p) => ({ ...p, relation_label_en: e.target.value }))} className={INPUT_CLS_REL} />
        </div>
      )}
    </div>
  );
}

function SpouseRelativesEditor({
  spouseId,
  relatives,
  lang,
  onRefresh,
}: {
  spouseId: string;
  relatives: SpouseRelative[];
  lang: Lang;
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [addVals, setAddVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const active = relatives.filter((r) => !r.removed_at);

  function startEdit(r: SpouseRelative) {
    setEditingId(r.relative_id);
    setEditVals({
      relation_code: r.relation_code || "",
      full_name: r.full_name || "",
      full_name_en: r.full_name_en || "",
      city: r.city || "",
      city_en: r.city_en || "",
      addr: r.addr || "",
      addr_en: r.addr_en || "",
      mobile: r.mobile || "",
      relation_label: r.relation_label || "",
      relation_label_en: r.relation_label_en || "",
    });
  }

  async function handleAdd() {
    setSaving(true);
    const supabase = createClient();
    const nameEn = addVals.full_name_en?.trim() || addVals.full_name?.trim() || "";
    const [nameHi, cityHi, addrHi] = await Promise.all([
      nameEn ? transliteratePhrase(nameEn) : null,
      addVals.city?.trim() ? transliteratePhrase(addVals.city.trim()) : null,
      addVals.addr?.trim() ? transliteratePhrase(addVals.addr.trim()) : null,
    ]);
    await supabase.rpc("add_spouse_relative", {
      p_spouse_id: spouseId,
      p_relation_code: addVals.relation_code || "other",
      p_relation_label: addVals.relation_label || null,
      p_relation_label_en: addVals.relation_label_en || null,
      p_full_name: nameHi || nameEn || null,
      p_full_name_en: nameEn || null,
      p_addr: addrHi || addVals.addr?.trim() || null,
      p_addr_en: addVals.addr?.trim() || null,
      p_city: cityHi || addVals.city?.trim() || null,
      p_city_en: addVals.city?.trim() || null,
      p_mobile: addVals.mobile?.trim() || null,
    });
    setShowAdd(false);
    setAddVals({});
    setSaving(false);
    onRefresh();
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setEditSaving(true);
    const supabase = createClient();
    const nameEn = editVals.full_name_en?.trim() || "";
    const [nameHi, cityHi, addrHi] = await Promise.all([
      nameEn && !editVals.full_name?.trim() ? transliteratePhrase(nameEn) : null,
      editVals.city_en?.trim() && !editVals.city?.trim() ? transliteratePhrase(editVals.city_en.trim()) : null,
      editVals.addr_en?.trim() && !editVals.addr?.trim() ? transliteratePhrase(editVals.addr_en.trim()) : null,
    ]);
    const fields: Record<string, string | null> = {};
    if (editVals.relation_code) fields.relation_code = editVals.relation_code;
    if (editVals.relation_label) fields.relation_label = editVals.relation_label;
    if (editVals.relation_label_en) fields.relation_label_en = editVals.relation_label_en;
    if (nameEn) fields.full_name_en = nameEn;
    if (nameHi || editVals.full_name?.trim()) fields.full_name = nameHi || editVals.full_name.trim();
    if (editVals.city?.trim() || cityHi) fields.city = cityHi || editVals.city.trim();
    if (editVals.city_en?.trim()) fields.city_en = editVals.city_en.trim();
    if (editVals.addr?.trim() || addrHi) fields.addr = addrHi || editVals.addr.trim();
    if (editVals.addr_en?.trim()) fields.addr_en = editVals.addr_en.trim();
    if (editVals.mobile?.trim()) fields.mobile = editVals.mobile.trim();
    if (Object.keys(fields).length > 0) {
      await supabase.rpc("update_spouse_relative", { p_relative_id: editingId, p_fields: fields });
    }
    setEditingId(null);
    setEditSaving(false);
    onRefresh();
  }

  async function handleRemove(id: string) {
    setRemoveLoading(true);
    const supabase = createClient();
    await supabase.rpc("delete_spouse_relative", { p_relative_id: id });
    setRemoveConfirm(null);
    setRemoveLoading(false);
    onRefresh();
  }

  return (
    <div className="mt-3 border-t border-[var(--hairline)] pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("section_wife_family", lang)}</p>
        <button onClick={() => { setShowAdd(!showAdd); setAddVals({}); }} className="text-[11px] font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]">
          {showAdd ? t("cancel", lang) : `＋ ${t("add_relative", lang)}`}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-3 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-3 space-y-2">
          <RelationDropdown value={addVals.relation_code || ""} onChange={(c) => setAddVals((p) => ({ ...p, relation_code: c }))} vals={addVals} setter={setAddVals} lang={lang} />
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("label_full_name", lang)}</label>
            <input type="text" value={addVals.full_name || ""} onChange={(e) => setAddVals((p) => ({ ...p, full_name: e.target.value }))} className={INPUT_CLS_REL} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("label_city", lang)}</label>
            <input type="text" value={addVals.city || ""} onChange={(e) => setAddVals((p) => ({ ...p, city: e.target.value }))} className={INPUT_CLS_REL} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("label_addr", lang)}</label>
            <input type="text" value={addVals.addr || ""} onChange={(e) => setAddVals((p) => ({ ...p, addr: e.target.value }))} className={INPUT_CLS_REL} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("label_mobile", lang)}</label>
            <input type="text" value={addVals.mobile || ""} onChange={(e) => setAddVals((p) => ({ ...p, mobile: e.target.value }))} className={INPUT_CLS_REL} />
          </div>
          <button onClick={handleAdd} disabled={saving || !addVals.full_name?.trim()} className="min-h-[36px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-4 py-1.5 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">
            {saving ? t("saving", lang) : t("add_relative", lang)}
          </button>
        </div>
      )}

      {/* Existing relatives */}
      {active.map((r) => {
        const rName = bi(r.full_name, r.full_name_en, lang);
        const rLabel = bi(r.relation_label, r.relation_label_en, lang) || "—";
        return (
          <div key={r.relative_id} className="mb-1.5 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--maroon-deep)]">{rName || "—"}</p>
                <p className="text-[11px] text-[var(--muted)]">{rLabel}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editingId === r.relative_id ? setEditingId(null) : startEdit(r)} className="text-[11px] font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]">
                  {editingId === r.relative_id ? t("cancel", lang) : t("edit", lang)}
                </button>
                {removeConfirm === r.relative_id ? (
                  <div className="flex gap-1">
                    <button onClick={() => handleRemove(r.relative_id)} disabled={removeLoading} className="text-[11px] font-medium text-[var(--maroon)]">{t("confirm", lang)}</button>
                    <button onClick={() => setRemoveConfirm(null)} className="text-[11px] text-[var(--muted)]">{t("cancel", lang)}</button>
                  </div>
                ) : (
                  <button onClick={() => setRemoveConfirm(r.relative_id)} className="text-[11px] text-[var(--muted)] hover:text-[var(--maroon)]">✕</button>
                )}
              </div>
            </div>
            {editingId === r.relative_id && (
              <div className="mt-2 border-t border-[var(--hairline)] pt-2 space-y-2">
                <RelationDropdown value={editVals.relation_code || ""} onChange={(c) => setEditVals((p) => ({ ...p, relation_code: c }))} vals={editVals} setter={setEditVals} lang={lang} />
                <div className="grid grid-cols-2 gap-1.5">
                  <div><label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("label_full_name", lang)} (Hi)</label><input type="text" value={editVals.full_name || ""} onChange={(e) => setEditVals((p) => ({ ...p, full_name: e.target.value }))} className={INPUT_CLS_REL} /></div>
                  <div><label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("label_full_name", lang)} (En)</label><input type="text" value={editVals.full_name_en || ""} onChange={(e) => setEditVals((p) => ({ ...p, full_name_en: e.target.value }))} className={INPUT_CLS_REL} /></div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div><label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("label_city", lang)}</label><input type="text" value={editVals.city || ""} onChange={(e) => setEditVals((p) => ({ ...p, city: e.target.value }))} className={INPUT_CLS_REL} /></div>
                  <div><label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("label_addr", lang)}</label><input type="text" value={editVals.addr || ""} onChange={(e) => setEditVals((p) => ({ ...p, addr: e.target.value }))} className={INPUT_CLS_REL} /></div>
                </div>
                <div><label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{t("label_mobile", lang)}</label><input type="text" value={editVals.mobile || ""} onChange={(e) => setEditVals((p) => ({ ...p, mobile: e.target.value }))} className={INPUT_CLS_REL} /></div>
                <button onClick={handleSaveEdit} disabled={editSaving} className="min-h-[32px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-3 py-1 text-xs font-medium text-[var(--ivory)] disabled:opacity-50">
                  {editSaving ? t("saving", lang) : t("save", lang)}
                </button>
              </div>
            )}
          </div>
        );
      })}
      {active.length === 0 && !showAdd && <p className="text-xs text-[var(--muted)]">—</p>}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function FamilyCardClient({
  member: m,
  spouses,
  childrenData,
  father,
  memberChildren,
  canEdit,
  userFamilyId,
  userId,
  isOwnCard,
}: {
  member: Member;
  spouses: Spouse[];
  childrenData: Child[];
  father: LineageMember | null;
  memberChildren: MemberChild[];
  canEdit: boolean;
  userFamilyId: string | null;
  userId: string | null;
  isOwnCard: boolean;
}) {
  const { lang } = useLang();
  const router = useRouter();

  // Edit blocking: if the member's own record has edit_blocked, suppress all editing UX
  const editBlocked = Boolean(m.edit_blocked) && canEdit;
  const canEditEffective = canEdit && !m.edit_blocked;

  // Edit state — auto-open when ?edit=1 is in the URL
  const [editing, setEditing] = useState(() =>
    canEditEffective && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edit") === "1"
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Form data
  const [memberEdits, setMemberEdits] = useState<MemberEdits>(() => memberToEdits(m));
  const [spouseEdits, setSpouseEdits] = useState<SpouseEdits[]>(() =>
    spouses.map(spouseToEdits)
  );
  const [childEdits, setChildEdits] = useState<ChildEdits[]>(() =>
    childrenData.map(childToEdits)
  );

  // Photo state: pending files + preview urls + removals
  const [memberPhotoFile, setMemberPhotoFile] = useState<File | null>(null);
  const [memberPhotoPreview, setMemberPhotoPreview] = useState<string | null>(null);
  const [memberPhotoRemoved, setMemberPhotoRemoved] = useState(false);

  const [spousePhotoFiles, setSpousePhotoFiles] = useState<Record<string, File | null>>({});
  const [spousePhotoPreviews, setSpousePhotoPreviews] = useState<Record<string, string | null>>({});
  const [spousePhotoRemoved, setSpousePhotoRemoved] = useState<Record<string, boolean>>({});

  const [childPhotoFiles, setChildPhotoFiles] = useState<Record<string, File | null>>({});
  const [childPhotoPreviews, setChildPhotoPreviews] = useState<Record<string, string | null>>({});
  const [childPhotoRemoved, setChildPhotoRemoved] = useState<Record<string, boolean>>({});

  // Photo validation helper
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Promotion state (mark child as married)
  const [promotingChildId, setPromotingChildId] = useState<string | null>(null);
  const [promoteHusbandName, setPromoteHusbandName] = useState("");
  const [promoteLoading, setPromoteLoading] = useState(false);

  // Add-husband loading (for married daughters)
  const [addHusbandLoading, setAddHusbandLoading] = useState(false);

  // Add-wife form state (for married male members)
  const [showAddWife, setShowAddWife] = useState(false);
  const [addWifeLoading, setAddWifeLoading] = useState(false);
  const [wifeForm, setWifeForm] = useState({ fullName: "", fatherName: "", birthGotra: "", birthGotraEn: "", education: "", dob: "" });

  // Add-children form state (multi-row, view mode, for any married member)
  const emptyChildRow = { fullName: "", gender: "", dob: "", education: "" };
  const [showAddChild, setShowAddChild] = useState(false);
  const [addChildLoading, setAddChildLoading] = useState(false);
  const [childRows, setChildRows] = useState<Array<{ fullName: string; gender: string; dob: string; education: string }>>([{ ...emptyChildRow }]);

  // Mark member as married (for unmarried members)
  const [showMarkMarried, setShowMarkMarried] = useState(false);
  const [markMarriedGender, setMarkMarriedGender] = useState<string>(m.gender || "");
  const [markMarriedLoading, setMarkMarriedLoading] = useState(false);

  // Remove spouse/child state
  const [removeSpouseConfirm, setRemoveSpouseConfirm] = useState<string | null>(null);
  const [removeChildConfirm, setRemoveChildConfirm] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  // Post-save married→unmarried prompt
  const [showUnmarriedPrompt, setShowUnmarriedPrompt] = useState(false);

  function handlePhotoSelect(
    file: File,
    setter: (f: File | null) => void,
    previewSetter: (url: string | null) => void,
    removeSetter: (v: boolean) => void
  ) {
    const err = validateImage(file);
    if (err) {
      setPhotoError(err === "photo_too_large" ? t("photo_too_large", lang) : err);
      setTimeout(() => setPhotoError(null), 3000);
      return;
    }
    setter(file);
    previewSetter(createPreviewUrl(file));
    removeSetter(false);
  }

  // Enter edit mode
  function startEditing() {
    setMemberEdits(memberToEdits(m));
    setSpouseEdits(spouses.map(spouseToEdits));
    setChildEdits(childrenData.map(childToEdits));
    setMemberPhotoFile(null);
    setMemberPhotoPreview(null);
    setMemberPhotoRemoved(false);
    setSpousePhotoFiles({});
    setSpousePhotoPreviews({});
    setSpousePhotoRemoved({});
    setChildPhotoFiles({});
    setChildPhotoPreviews({});
    setChildPhotoRemoved({});
    setPhotoError(null);
    setToast(null);
    setRemoveSpouseConfirm(null);
    setRemoveChildConfirm(null);
    setShowUnmarriedPrompt(false);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setToast(null);
  }

  // ── Add husband (for married daughters without a spouse row) ────────────

  async function handleAddHusband() {
    if (addHusbandLoading) return;
    setAddHusbandLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("add_spouse", {
        p_member_id: m.member_id,
        p_full_name: m.husband_name || "",
        p_full_name_en: m.husband_name_en || m.husband_name || null,
        p_gender: "M",
      });

      if (error) {
        console.error("add_spouse RPC failed:", error);
        setToast({ type: "error", msg: t("save_error", lang) });
        return;
      }
      router.refresh();
    } finally {
      setAddHusbandLoading(false);
    }
  }

  // ── Add children bulk (view mode, for any married member) ───────────────

  async function handleAddChildrenBulk() {
    if (addChildLoading) return;
    const filledRows = childRows.filter((r) => r.fullName.trim());
    if (filledRows.length === 0) {
      setToast({ type: "error", msg: t("save_error", lang) });
      return;
    }

    setAddChildLoading(true);
    try {
      const supabase = createClient();
      // Transliterate names and education to Hindi (non-blocking)
      const payload = await Promise.all(
        filledRows.map(async (r) => {
          const nameEn = r.fullName.trim();
          const eduEn = r.education.trim() || null;
          const [nameHi, eduHi] = await Promise.all([
            nameEn ? transliteratePhrase(nameEn) : null,
            eduEn ? transliteratePhrase(eduEn) : null,
          ]);
          return {
            full_name: nameHi || nameEn,
            full_name_en: nameEn,
            gender: r.gender.trim() || null,
            dob: r.dob || null,
            education: eduHi || eduEn,
            education_en: eduEn,
          };
        }),
      );

      const { error } = await supabase.rpc("add_children_bulk", {
        p_parent_member_id: m.member_id,
        p_children: payload,
      });

      if (error) {
        console.error("add_children_bulk RPC failed:", error);
        setToast({ type: "error", msg: t("save_error", lang) });
        setAddChildLoading(false);
        return;
      }

      setShowAddChild(false);
      setChildRows([{ ...emptyChildRow }]);
      router.refresh();
    } catch (err) {
      console.error("Add children error:", err);
      setToast({ type: "error", msg: t("save_error", lang) });
    } finally {
      setAddChildLoading(false);
    }
  }

  // ── Mark member as married ──────────────────────────────────────────────

  async function handleMarkMemberMarried() {
    if (markMarriedLoading) return;
    setMarkMarriedLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("mark_member_married", {
        p_member_id: m.member_id,
        p_gender: m.gender ? null : (markMarriedGender || null),
      });

      if (error) {
        console.error("mark_member_married failed:", error);
        setToast({ type: "error", msg: t("save_error", lang) });
        setMarkMarriedLoading(false);
        return;
      }

      setShowMarkMarried(false);
      router.refresh();
    } catch (err) {
      console.error("Mark married error:", err);
      setToast({ type: "error", msg: t("save_error", lang) });
    } finally {
      setMarkMarriedLoading(false);
    }
  }

  // ── Add wife (for married male members without a spouse row) ────────────

  async function handleAddWife() {
    if (addWifeLoading) return;
    setAddWifeLoading(true);
    try {
      const supabase = createClient();
      const nameVal = wifeForm.fullName.trim();
      // Transliterate English values to Hindi (non-blocking: null = skip)
      const [nameHi, fatherHi, eduHi] = await Promise.all([
        nameVal ? transliteratePhrase(nameVal) : null,
        wifeForm.fatherName.trim() ? transliteratePhrase(wifeForm.fatherName.trim()) : null,
        wifeForm.education.trim() ? transliteratePhrase(wifeForm.education.trim()) : null,
      ]);
      const { error } = await supabase.rpc("add_spouse", {
        p_member_id: m.member_id,
        p_full_name: nameHi || nameVal || "",
        p_full_name_en: nameVal || null,
        p_gender: "F",
        p_father_name: fatherHi || wifeForm.fatherName.trim() || null,
        p_father_name_en: wifeForm.fatherName.trim() || null,
        p_birth_gotra: wifeForm.birthGotra.trim() || null,
        p_birth_gotra_en: wifeForm.birthGotraEn.trim() || wifeForm.birthGotra.trim() || null,
        p_education: eduHi || wifeForm.education.trim() || null,
        p_education_en: wifeForm.education.trim() || null,
        p_dob: wifeForm.dob || null,
      });

      if (error) {
        console.error("add_spouse (wife) RPC failed:", error);
        setToast({ type: "error", msg: t("save_error", lang) });
        setAddWifeLoading(false);
        return;
      }

      setShowAddWife(false);
      setWifeForm({ fullName: "", fatherName: "", birthGotra: "", birthGotraEn: "", education: "", dob: "" });
      router.refresh();
    } catch (err) {
      console.error("Add wife error:", err);
      setToast({ type: "error", msg: t("save_error", lang) });
    } finally {
      setAddWifeLoading(false);
    }
  }

  // ── Promote child to member (mark as married) ──────────────────────────

  async function handlePromoteChild(childId: string, isDaughter: boolean) {
    if (promoteLoading) return;
    setPromoteLoading(true);
    try {
      const supabase = createClient();
      const hNameEn = isDaughter ? (promoteHusbandName.trim() || null) : null;
      const hNameHi = hNameEn ? (await transliteratePhrase(hNameEn)) : null;
      const { error } = await supabase.rpc("promote_child_to_member", {
        p_child_id: childId,
        p_husband_name: hNameHi || hNameEn,
        p_husband_name_en: hNameEn,
      });

      if (error) {
        console.error("promote_child_to_member failed:", error);
        setToast({ type: "error", msg: t("save_error", lang) });
        setPromoteLoading(false);
        return;
      }

      setPromotingChildId(null);
      setPromoteHusbandName("");
      router.refresh();
    } catch (err) {
      console.error("Promotion error:", err);
      setToast({ type: "error", msg: t("save_error", lang) });
    } finally {
      setPromoteLoading(false);
    }
  }

  // ── Soft-remove spouse/child ────────────────────────────────────────────

  async function handleDeleteSpouse(spouseId: string) {
    if (removeLoading) return;
    setRemoveLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_spouse", { p_spouse_id: spouseId });
      if (error) {
        console.error("delete_spouse failed:", error);
        setToast({ type: "error", msg: t("save_error", lang) });
        return;
      }
      setRemoveSpouseConfirm(null);
      router.refresh();
    } catch (err) {
      console.error("Delete spouse error:", err);
      setToast({ type: "error", msg: t("save_error", lang) });
    } finally {
      setRemoveLoading(false);
    }
  }

  async function handleDeleteChild(childId: string) {
    if (removeLoading) return;
    setRemoveLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_child", { p_child_id: childId });
      if (error) {
        console.error("delete_child failed:", error);
        setToast({ type: "error", msg: t("save_error", lang) });
        return;
      }
      setRemoveChildConfirm(null);
      router.refresh();
    } catch (err) {
      console.error("Delete child error:", err);
      setToast({ type: "error", msg: t("save_error", lang) });
    } finally {
      setRemoveLoading(false);
    }
  }

  // Helper to update a field in memberEdits bilingually
  function setMemberField(baseField: string, value: string) {
    setMemberEdits((prev) =>
      setEditVal(prev as unknown as Record<string, string>, baseField, lang, value) as unknown as MemberEdits
    );
  }

  function setSpouseField(idx: number, baseField: string, value: string) {
    setSpouseEdits((prev) => {
      const copy = [...prev];
      copy[idx] = setEditVal(
        copy[idx] as unknown as Record<string, string>,
        baseField,
        lang,
        value
      ) as unknown as SpouseEdits;
      return copy;
    });
  }

  function setChildField(idx: number, baseField: string, value: string) {
    setChildEdits((prev) => {
      const copy = [...prev];
      copy[idx] = setEditVal(
        copy[idx] as unknown as Record<string, string>,
        baseField,
        lang,
        value
      ) as unknown as ChildEdits;
      return copy;
    });
  }

  // Plain (non-bilingual) field setter for member
  function setMemberPlain(field: keyof MemberEdits, value: string) {
    setMemberEdits((prev) => ({ ...prev, [field]: value }));
  }

  function setSpousePlain(idx: number, field: keyof SpouseEdits, value: string) {
    setSpouseEdits((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }

  function setChildPlain(idx: number, field: keyof ChildEdits, value: string) {
    setChildEdits((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }

  // ── Save ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setToast(null);

    try {
      // 0. Pre-save sweep: transliterate any empty Hindi fields (non-blocking)
      const memberPairs: [string, string][] = [
        ["full_name", "full_name_en"], ["education", "education_en"], ["occupation", "occupation_en"],
        ["addr_line1", "addr_line1_en"], ["addr_line2", "addr_line2_en"], ["city", "city_en"],
        ["state", "state_en"], ["country", "country_en"], ["gotra", "gotra_en"], ["husband_name", "husband_name_en"], ["notes", "notes_en"],
      ];
      const sweptMember = await sweepAutoHindi(memberEdits as unknown as Record<string, string>, memberPairs);
      setMemberEdits(sweptMember as unknown as MemberEdits);

      const spousePairs: [string, string][] = [
        ["full_name", "full_name_en"], ["father_name", "father_name_en"],
        ["birth_gotra", "birth_gotra_en"], ["education", "education_en"], ["notes", "notes_en"],
      ];
      const sweptSpouses = await Promise.all(
        spouseEdits.map((se) => sweepAutoHindi(se as unknown as Record<string, string>, spousePairs)),
      );
      setSpouseEdits(sweptSpouses as unknown as SpouseEdits[]);

      const childPairs: [string, string][] = [["full_name", "full_name_en"], ["education", "education_en"], ["notes", "notes_en"], ["occupation", "occupation_en"]];
      const sweptChildren = await Promise.all(
        childEdits.map((ce) => sweepAutoHindi(ce as unknown as Record<string, string>, childPairs)),
      );
      setChildEdits(sweptChildren as unknown as ChildEdits[]);

      // Use swept values for the rest of save
      const memberEditsLocal = sweptMember as unknown as MemberEdits;
      const spouseEditsLocal = sweptSpouses as unknown as SpouseEdits[];
      const childEditsLocal = sweptChildren as unknown as ChildEdits[];

      const supabase = createClient();
      const familyId = userFamilyId!;

      // 1. Upload photos
      let memberPhotoUrl = m.photo_url;
      if (memberPhotoRemoved) {
        memberPhotoUrl = null;
      }
      if (memberPhotoFile) {
        memberPhotoUrl = await uploadPhoto(memberPhotoFile, familyId, "members", m.member_id);
      }

      const spousePhotoUrls: Record<string, string | null> = {};
      for (const s of spouses) {
        if (spousePhotoRemoved[s.spouse_id]) {
          spousePhotoUrls[s.spouse_id] = null;
        } else if (spousePhotoFiles[s.spouse_id]) {
          spousePhotoUrls[s.spouse_id] = await uploadPhoto(
            spousePhotoFiles[s.spouse_id]!,
            familyId,
            "spouses",
            s.spouse_id
          );
        }
      }

      const childPhotoUrls: Record<string, string | null> = {};
      for (const c of childrenData) {
        if (childPhotoRemoved[c.child_id]) {
          childPhotoUrls[c.child_id] = null;
        } else if (childPhotoFiles[c.child_id]) {
          childPhotoUrls[c.child_id] = await uploadPhoto(
            childPhotoFiles[c.child_id]!,
            familyId,
            "children",
            c.child_id
          );
        }
      }

      // 2. Build payloads and save with edit history

      // --- Member ---
      const memberPayload = buildBilingualPayload(
        memberEditsLocal as unknown as Record<string, string>,
        m as unknown as Record<string, string | null>,
        ["full_name", "education", "occupation", "addr_line1", "addr_line2", "city", "country", "state", "gotra", "husband_name", "notes"],
        ["dob", "mobile_1", "mobile_2", "email", "pincode", "marital_status"]
      );
      if (memberPhotoUrl !== m.photo_url) {
        memberPayload.photo_url = memberPhotoUrl;
      }

      if (Object.keys(memberPayload).length > 0) {
        const { data: mUpd, error } = await supabase
          .from("members")
          .update(memberPayload)
          .eq("member_id", m.member_id)
          .select("member_id");
        if (error) throw error;
        if (!mUpd || mUpd.length === 0) throw new Error("edit_blocked");
        const { error: histErr } = await supabase.from("edit_history").insert({
          table_name: "members",
          record_id: m.member_id,
          family_id: familyId,
          changed_by: userId,
          previous_values: m,
        });
        if (histErr) console.warn("edit_history (members) insert failed:", histErr.message);
      }

      // --- Spouses ---
      for (let i = 0; i < spouses.length; i++) {
        const s = spouses[i];
        const edits = spouseEditsLocal[i];
        const payload = buildBilingualPayload(
          edits as unknown as Record<string, string>,
          s as unknown as Record<string, string | null>,
          ["full_name", "birth_gotra", "father_name", "education", "notes"],
          ["dob", "date_of_marriage", "mobile", "email"]
        );
        if (spousePhotoUrls[s.spouse_id] !== undefined) {
          payload.photo_url = spousePhotoUrls[s.spouse_id];
        }

        if (Object.keys(payload).length > 0) {
          const { data: sUpd, error } = await supabase
            .from("spouses")
            .update(payload)
            .eq("spouse_id", s.spouse_id)
            .select("spouse_id");
          if (error) throw error;
          if (!sUpd || sUpd.length === 0) throw new Error("edit_blocked");
          const { error: histErr2 } = await supabase.from("edit_history").insert({
            table_name: "spouses",
            record_id: s.spouse_id,
            family_id: familyId,
            changed_by: userId,
            previous_values: s,
          });
          if (histErr2) console.warn("edit_history (spouses) insert failed:", histErr2.message);
        }
      }

      // --- Children ---
      for (let i = 0; i < childrenData.length; i++) {
        const c = childrenData[i];
        const edits = childEditsLocal[i];
        const payload = buildBilingualPayload(
          edits as unknown as Record<string, string>,
          c as unknown as Record<string, string | null>,
          ["full_name", "education", "notes", "occupation"],
          ["gender", "dob", "mobile", "email"]
        );
        if (childPhotoUrls[c.child_id] !== undefined) {
          payload.photo_url = childPhotoUrls[c.child_id];
        }

        if (Object.keys(payload).length > 0) {
          const { data: cUpd, error } = await supabase
            .from("children")
            .update(payload)
            .eq("child_id", c.child_id)
            .select("child_id");
          if (error) throw error;
          if (!cUpd || cUpd.length === 0) throw new Error("edit_blocked");
          const { error: histErr3 } = await supabase.from("edit_history").insert({
            table_name: "children",
            record_id: c.child_id,
            family_id: familyId,
            changed_by: userId,
            previous_values: c,
          });
          if (histErr3) console.warn("edit_history (children) insert failed:", histErr3.message);
        }
      }

      // Check for married → unmarried transition
      const wasMarried = m.marital_status === "married";
      const nowUnmarried = memberEditsLocal.marital_status !== "married" && memberEditsLocal.marital_status !== "";
      if (wasMarried && nowUnmarried && (spouses.length > 0 || childrenData.length > 0)) {
        setShowUnmarriedPrompt(true);
      }

      setEditing(false);
      setToast({ type: "success", msg: t("saved", lang) });
      setTimeout(() => setToast(null), 3000);
      router.refresh(); // re-fetch server data
    } catch (err: unknown) {
      console.error("Save error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      // Detect edit-blocked race condition (RLS rejection / zero rows)
      const isBlocked = errMsg.includes("edit_blocked") || errMsg.includes("new row violates") || errMsg.includes("0 rows");
      const isNotesTooLong = errMsg.includes("notes") && (errMsg.includes("constraint") || errMsg.includes("1000") || errMsg.includes("too long"));
      const msg = isBlocked ? t("edit_blocked_banner", lang) : isNotesTooLong ? t("notes_too_long", lang) : t("save_error", lang);
      setToast({ type: "error", msg });
    } finally {
      setSaving(false);
    }
  }

  // ── Derived display values ──────────────────────────────────────────────

  const name = bi(m.full_name, m.full_name_en, lang);
  const gotra = bi(m.gotra, m.gotra_en, lang);
  const education = bi(m.education, m.education_en, lang);
  const occupation = bi(m.occupation, m.occupation_en, lang);
  const memberNotes = bi(m.notes, m.notes_en, lang);
  const mRec = m as unknown as Record<string, string | null>;
  const city = bi(m.city, m.city_en, lang);
  const stateDisplay = bi(mRec.state, mRec.state_en, lang);
  const countryDisplay = bi(mRec.country, mRec.country_en, lang);
  const addr1 = bi(m.addr_line1, m.addr_line1_en, lang);
  const addr2 = bi(m.addr_line2, m.addr_line2_en, lang);
  const address = [addr1, addr2, city, stateDisplay, m.pincode, countryDisplay].filter(Boolean).join(", ");
  const husbandName = bi(m.husband_name, m.husband_name_en, lang);
  const isFemale = m.gender === "F";
  const isMarriedDaughter = m.member_id.startsWith("D");
  const isMarriedMember = m.marital_status === "married";
  const memberIsFemale = m.gender === "F" || m.gender === "female";
  // For married daughters: if a real spouse row exists, show that instead of text husband_name
  const hasRealHusbandSpouse = isMarriedDaughter && spouses.length > 0;

  // ── Merged children list (member-children eldest-first from RPC, then child-rows) ──

  type MergedChild =
    | { source: "member"; data: MemberChild }
    | { source: "child"; data: Child; idx: number };

  const mergedChildren: MergedChild[] = [
    ...memberChildren.map((mc): MergedChild => ({ source: "member", data: mc })),
    ...childrenData.map((c, idx): MergedChild => ({ source: "child", data: c, idx })),
  ];

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-24 md:ml-[240px] md:pb-8">
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b border-[var(--hairline)] px-4 pb-3 shadow-[var(--shadow-header)]"
        style={{ background: "linear-gradient(180deg, #33121a, var(--ink))", paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}
      >
        <div className="mx-auto flex max-w-lg md:max-w-2xl items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label={t("reg_back", lang)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--gold)] hover:bg-[var(--maroon-deep)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 font-display text-lg font-semibold text-[#F4E3C1]">
            {t("family_detail", lang)}
          </h1>
          <LanguageToggle />
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="mx-auto mt-2 max-w-lg md:max-w-2xl px-4">
          <div
            className="rounded-[var(--r-sm)] px-4 py-2.5 text-sm font-medium"
            style={{ background: toast.type === "success" ? "rgba(22,101,52,0.08)" : "rgba(110,30,42,0.06)" }}
          >
            <span className={toast.type === "success" ? "text-green-700" : "text-[var(--maroon-deep)]"}>
              {toast.msg}
            </span>
          </div>
        </div>
      )}

      {/* Photo error toast */}
      {photoError && (
        <div className="mx-auto mt-2 max-w-lg md:max-w-2xl px-4">
          <div className="rounded-[var(--r-sm)] px-4 py-2.5 text-sm font-medium text-[var(--maroon-deep)]" style={{ background: "rgba(110,30,42,0.06)" }}>
            {photoError}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-lg md:max-w-2xl px-4 pt-4">

        {/* Edit-blocked banner */}
        {editBlocked && (
          <div className="mb-3 flex items-center gap-2 rounded-[var(--r)] border-2 border-[var(--maroon)]/30 bg-[var(--raised)] px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-[var(--maroon)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-sm text-[var(--maroon)]">{t("edit_blocked_banner", lang)}</p>
          </div>
        )}

        {/* Edit mode language hint */}
        {editing && (
          <div className="mb-3 rounded-[var(--r-sm)] bg-[var(--cream-panel)] px-3 py-2 text-center text-xs text-[var(--muted)]">
            {lang === "en" ? t("editing_in_en", lang) : t("editing_in_hi", lang)}
          </div>
        )}

        {/* ── MEMBER IDENTITY CARD ────────────────────────────────────────── */}
        <FadeIn>
        <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-5 shadow-card">
          <div className="flex items-center gap-4">
            {editing ? (
              <div className="flex flex-col items-center gap-1">
                <PhotoAvatar
                  photoUrl={m.photo_url}
                  previewUrl={memberPhotoRemoved ? null : memberPhotoPreview}
                  fallbackInitial={name?.charAt(0) || "?"}
                  editing={true}
                  onFileSelect={(f) =>
                    handlePhotoSelect(f, setMemberPhotoFile, setMemberPhotoPreview, setMemberPhotoRemoved)
                  }
                  onRemove={() => {
                    setMemberPhotoRemoved(true);
                    setMemberPhotoFile(null);
                    setMemberPhotoPreview(null);
                  }}
                />
                <span className="text-[11px] font-medium text-[var(--gold-deep)]">Upload Picture</span>
              </div>
            ) : (
              <InitialsAvatar
                name={m.full_name}
                nameEn={m.full_name_en}
                photoUrl={m.photo_url}
                deceased={m.is_deceased}
              />
            )}
            <div className="min-w-0 flex-1">
              {editing ? (
                <AutoHindiEditRow
                  label={t("label_full_name", lang)}
                  lang={lang}
                  englishValue={memberEdits.full_name_en}
                  hindiValue={memberEdits.full_name}
                  onChangeActive={(v) => setMemberField("full_name", v)}
                  setHindi={(v) => setMemberEdits((p) => ({ ...p, full_name: v }))}
                />
              ) : (
                <>
                  <h2 className="font-display text-xl font-semibold leading-snug text-[var(--maroon-deep)]">
                    {name}
                  </h2>
                  {m.is_deceased && (
                    <span className="mt-1 inline-block text-[11px] font-medium uppercase tracking-wider text-[var(--gold-deep)]">
                      In remembrance
                    </span>
                  )}
                  {isOwnCard && !editing && (
                    <span className="mt-1 inline-flex items-center rounded-full border border-[var(--gold)]/20 bg-[var(--cream-panel)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[var(--gold-deep)] font-sans">
                      {t("this_is_you", lang)}
                    </span>
                  )}
                  {gotra && (
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {t("label_gotra", lang)}: {gotra}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Edit pencil */}
            {canEditEffective && !editing && (
              <button
                onClick={startEditing}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--gold)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
                title={t("edit", lang)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>

          {editing && (
            <div className="mt-3">
              <GotraSelect
                label={t("label_gotra", lang)}
                valueHi={memberEdits.gotra}
                valueEn={memberEdits.gotra_en}
                onChange={(hi, en) => setMemberEdits((prev) => ({ ...prev, gotra: hi, gotra_en: en }))}
              />
            </div>
          )}

        </div>
        </FadeIn>

        {/* ── PERSONAL DETAILS ─────────────────────────────────────────── */}
        <SectionTitle>
          👤 {t("section_personal", lang)}
        </SectionTitle>
        <FadeIn delay={0.05}>
        <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
          {editing ? (
            <>
              <AutoHindiEditRow
                label={t("label_education", lang)}
                lang={lang}
                englishValue={memberEdits.education_en}
                hindiValue={memberEdits.education}
                onChangeActive={(v) => setMemberField("education", v)}
                setHindi={(v) => setMemberEdits((p) => ({ ...p, education: v }))}
              />
              <AutoHindiEditRow
                label={t("label_occupation", lang)}
                lang={lang}
                englishValue={memberEdits.occupation_en}
                hindiValue={memberEdits.occupation}
                onChangeActive={(v) => setMemberField("occupation", v)}
                setHindi={(v) => setMemberEdits((p) => ({ ...p, occupation: v }))}
              />
              <DateField
                label={t("label_dob", lang)}
                value={memberEdits.dob}
                onChange={(v) => setMemberPlain("dob", v)}
              />
              <div className="border-b border-[var(--hairline)] py-2 last:border-0">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {t("label_marital_status", lang)}
                </label>
                <select
                  value={memberEdits.marital_status}
                  onChange={(e) => setMemberPlain("marital_status", e.target.value)}
                  className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                >
                  <option value="">— Select —</option>
                  <option value="married">{lang === "en" ? "Married" : "विवाहित"}</option>
                  <option value="unmarried">{lang === "en" ? "Unmarried" : "अविवाहित"}</option>
                </select>
              </div>
              {/* Notes textarea */}
              <div className="border-b border-[var(--hairline)] py-2 last:border-0">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("label_notes", lang)}</label>
                <textarea
                  value={lang === "en" ? memberEdits.notes_en : memberEdits.notes}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (lang === "en") setMemberEdits((p) => ({ ...p, notes_en: v }));
                    else setMemberEdits((p) => ({ ...p, notes: v }));
                  }}
                  rows={4}
                  maxLength={1000}
                  className="min-h-[80px] w-full resize-y rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                />
                <p className="mt-1 text-right text-[11px] text-[var(--muted)]">
                  {(lang === "en" ? memberEdits.notes_en : memberEdits.notes).length} / 1000
                </p>
              </div>
            </>
          ) : (
            <>
              <InfoRow label={t("label_education", lang)} value={education} />
              <InfoRow label={t("label_occupation", lang)} value={occupation} />
              <InfoRow label={t("label_dob", lang)} value={m.dob} />
              {m.is_deceased && (
                <InfoRow label={t("label_dod", lang)} value={m.date_of_death} />
              )}
              <InfoRow label={t("label_marital_status", lang)} value={m.marital_status} />
              {memberNotes && (
                <div className="border-b border-[var(--hairline)] py-2 last:border-0">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("label_notes", lang)}</p>
                  <p className="whitespace-pre-line text-sm italic text-[var(--text-body)]">{memberNotes}</p>
                </div>
              )}

              {/* Mark member as married — under the marital status row */}
              {canEditEffective && m.marital_status !== "married" && !showMarkMarried && (
                <button
                  onClick={() => setShowMarkMarried(true)}
                  className="mt-2 flex min-h-[44px] items-center rounded-[var(--r)] border border-[var(--hairline)] px-3 py-1.5 text-[13px] font-medium text-[var(--gold-deep)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
                >
                  {t("mark_as_married", lang)}
                </button>
              )}

              {showMarkMarried && (
                <div className="mt-2 rounded-[var(--r-sm)] p-4" style={{ background: "rgba(110,30,42,0.06)" }}>
                  <p className="text-sm text-[var(--maroon-deep)]">
                    {t("mark_married_confirm", lang).replace("{name}", name || "")}
                  </p>
                  {!m.gender && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMarkMarriedGender("M")}
                        className={`min-h-[44px] flex-1 rounded-[var(--r)] text-sm font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                          markMarriedGender === "M"
                            ? "bg-[var(--maroon)] text-[var(--ivory)]"
                            : "border border-[var(--hairline)] bg-[var(--raised)] text-[var(--muted)] hover:bg-[var(--cream-panel)]"
                        }`}
                      >
                        {t("male", lang)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarkMarriedGender("F")}
                        className={`min-h-[44px] flex-1 rounded-[var(--r)] text-sm font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                          markMarriedGender === "F"
                            ? "bg-[var(--maroon)] text-[var(--ivory)]"
                            : "border border-[var(--hairline)] bg-[var(--raised)] text-[var(--muted)] hover:bg-[var(--cream-panel)]"
                        }`}
                      >
                        {t("female", lang)}
                      </button>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setShowMarkMarried(false)}
                      disabled={markMarriedLoading}
                      className="min-h-[44px] flex-1 rounded-[var(--r)] border border-[var(--hairline)] bg-[var(--raised)] text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)] disabled:opacity-50"
                    >
                      {t("cancel", lang)}
                    </button>
                    <button
                      onClick={handleMarkMemberMarried}
                      disabled={markMarriedLoading || (!m.gender && !markMarriedGender)}
                      className="min-h-[44px] flex-1 rounded-[var(--r)] bg-[var(--maroon)] text-sm font-medium text-[var(--ivory)] motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] active:scale-[.98] disabled:opacity-50"
                    >
                      {markMarriedLoading ? t("saving", lang) : t("confirm", lang)}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        </FadeIn>

        {/* ── CONTACT ──────────────────────────────────────────────────── */}
        {(editing || m.mobile_1 || m.mobile_2 || m.email || address) && (
          <>
            <SectionTitle>
              📞 {t("section_contact", lang)}
            </SectionTitle>
            <FadeIn delay={0.1}>
            <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
              {editing ? (
                <>
                  <PhoneField label={t("label_mobile", lang)} value={memberEdits.mobile_1} onChange={(v) => setMemberPlain("mobile_1", v)} />
                  <PhoneField label={t("label_mobile_2", lang)} value={memberEdits.mobile_2} onChange={(v) => setMemberPlain("mobile_2", v)} />
                  <EditRow label={t("label_email", lang)} value={memberEdits.email} onChange={(v) => setMemberPlain("email", v)} type="email" />
                  <AutoHindiEditRow label={t("label_addr_line1", lang)} lang={lang} englishValue={memberEdits.addr_line1_en} hindiValue={memberEdits.addr_line1} onChangeActive={(v) => setMemberField("addr_line1", v)} setHindi={(v) => setMemberEdits((p) => ({ ...p, addr_line1: v }))} />
                  <AutoHindiEditRow label={t("label_addr_line2", lang)} lang={lang} englishValue={memberEdits.addr_line2_en} hindiValue={memberEdits.addr_line2} onChangeActive={(v) => setMemberField("addr_line2", v)} setHindi={(v) => setMemberEdits((p) => ({ ...p, addr_line2: v }))} />
                  <CountryStateCity
                    country={memberEdits.country}
                    countryEn={memberEdits.country_en}
                    state={memberEdits.state}
                    stateEn={memberEdits.state_en}
                    city={memberEdits.city}
                    cityEn={memberEdits.city_en}
                    onChange={(partial) =>
                      setMemberEdits((prev) => ({
                        ...prev,
                        ...(partial.country !== undefined && { country: partial.country }),
                        ...(partial.countryEn !== undefined && { country_en: partial.countryEn }),
                        ...(partial.state !== undefined && { state: partial.state }),
                        ...(partial.stateEn !== undefined && { state_en: partial.stateEn }),
                        ...(partial.city !== undefined && { city: partial.city }),
                        ...(partial.cityEn !== undefined && { city_en: partial.cityEn }),
                      }))
                    }
                  />
                  <EditRow label={t("label_pincode", lang)} value={memberEdits.pincode} onChange={(v) => setMemberPlain("pincode", v)} />
                </>
              ) : (
                <>
                  <InfoRow label={t("label_mobile", lang)} value={m.mobile_1} />
                  {m.mobile_2 && <InfoRow label={t("label_mobile_2", lang)} value={m.mobile_2} />}
                  <InfoRow label={t("label_email", lang)} value={m.email} />
                  {address && <InfoRow label={t("label_address", lang)} value={address} />}
                </>
              )}
            </div>
            </FadeIn>
          </>
        )}

        {/* ── HUSBAND (for married women — text fallback when no spouse row) ── */}
        {isFemale && !hasRealHusbandSpouse && (husbandName || editing) && (
          <>
            <SectionTitle>
              💑 {t("section_husband", lang)}
            </SectionTitle>
            <FadeIn delay={0.15}>
            <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
              {editing ? (
                <>
                  <AutoHindiEditRow
                    label={t("label_husband_name", lang)}
                    lang={lang}
                    englishValue={memberEdits.husband_name_en}
                    hindiValue={memberEdits.husband_name}
                    onChangeActive={(v) => setMemberField("husband_name", v)}
                    setHindi={(v) => setMemberEdits((p) => ({ ...p, husband_name: v }))}
                  />
                  {isMarriedDaughter && canEditEffective && (
                    <button
                      onClick={handleAddHusband}
                      disabled={addHusbandLoading}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--r)] border border-dashed border-[var(--gold)]/40 py-2.5 text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)] disabled:opacity-50"
                    >
                      {addHusbandLoading ? t("saving", lang) : `+ ${t("add_husband_details", lang)}`}
                    </button>
                  )}
                </>
              ) : (
                <InfoRow label={t("label_husband_name", lang)} value={husbandName} />
              )}
            </div>
            </FadeIn>
          </>
        )}

        {/* ── SPOUSE (real spouse rows) ── */}
        {spouses.length > 0 && (
          <>
            <SectionTitle>
              💑 {t("section_spouse", lang)}
            </SectionTitle>
            {spouses.map((s, idx) => {
              const sName = bi(s.full_name, s.full_name_en, lang);
              const edits = spouseEdits[idx];

              return (
                <FadeIn key={s.spouse_id} delay={0.15}>
                <div className="mb-2 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
                  <div className="flex items-center gap-3 mb-2">
                    <PhotoAvatar
                      photoUrl={s.photo_url}
                      previewUrl={
                        editing
                          ? spousePhotoRemoved[s.spouse_id]
                            ? null
                            : spousePhotoPreviews[s.spouse_id] || null
                          : null
                      }
                      fallbackInitial={sName?.charAt(0) || "?"}
                      editing={editing}
                      size="sm"
                      onFileSelect={(f) =>
                        handlePhotoSelect(
                          f,
                          (file) => setSpousePhotoFiles((p) => ({ ...p, [s.spouse_id]: file })),
                          (url) => setSpousePhotoPreviews((p) => ({ ...p, [s.spouse_id]: url })),
                          (v) => setSpousePhotoRemoved((p) => ({ ...p, [s.spouse_id]: v }))
                        )
                      }
                      onRemove={() => {
                        setSpousePhotoRemoved((p) => ({ ...p, [s.spouse_id]: true }));
                        setSpousePhotoFiles((p) => ({ ...p, [s.spouse_id]: null }));
                        setSpousePhotoPreviews((p) => ({ ...p, [s.spouse_id]: null }));
                      }}
                    />
                    {editing ? (
                      <div className="flex-1">
                        <AutoHindiEditRow
                          label={t("label_full_name", lang)}
                          lang={lang}
                          englishValue={edits.full_name_en}
                          hindiValue={edits.full_name}
                          onChangeActive={(v) => setSpouseField(idx, "full_name", v)}
                          setHindi={(v) => setSpouseEdits((prev) => { const c = [...prev]; c[idx] = { ...c[idx], full_name: v }; return c; })}
                        />
                      </div>
                    ) : (
                      <p className="font-display font-semibold text-[var(--maroon-deep)]">{sName}</p>
                    )}
                  </div>

                  {editing ? (
                    <>
                      <AutoHindiEditRow label={t("label_father_name", lang)} lang={lang} englishValue={edits.father_name_en} hindiValue={edits.father_name} onChangeActive={(v) => setSpouseField(idx, "father_name", v)} setHindi={(v) => setSpouseEdits((prev) => { const c = [...prev]; c[idx] = { ...c[idx], father_name: v }; return c; })} />
                      <GotraSelect
                        label={t("label_birth_gotra", lang)}
                        valueHi={edits.birth_gotra}
                        valueEn={edits.birth_gotra_en}
                        onChange={(hi, en) => setSpouseEdits((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], birth_gotra: hi, birth_gotra_en: en };
                          return copy;
                        })}
                      />
                      <AutoHindiEditRow label={t("label_education", lang)} lang={lang} englishValue={edits.education_en} hindiValue={edits.education} onChangeActive={(v) => setSpouseField(idx, "education", v)} setHindi={(v) => setSpouseEdits((prev) => { const c = [...prev]; c[idx] = { ...c[idx], education: v }; return c; })} />
                      <DateField label={t("label_dob", lang)} value={edits.dob} onChange={(v) => setSpousePlain(idx, "dob", v)} />
                      <DateField label={t("label_dom", lang)} value={edits.date_of_marriage} onChange={(v) => setSpousePlain(idx, "date_of_marriage", v)} />
                      <PhoneField label={t("label_mobile", lang)} value={edits.mobile} onChange={(v) => setSpousePlain(idx, "mobile", v)} />
                      <EditRow label={t("label_email", lang)} value={edits.email} onChange={(v) => setSpousePlain(idx, "email", v)} type="email" />
                      {/* Notes */}
                      <div className="border-b border-[var(--hairline)] py-2 last:border-0">
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("label_notes", lang)}</label>
                        <textarea
                          value={lang === "en" ? edits.notes_en : edits.notes}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSpouseEdits((prev) => {
                              const c = [...prev];
                              c[idx] = { ...c[idx], [lang === "en" ? "notes_en" : "notes"]: v };
                              return c;
                            });
                          }}
                          rows={4}
                          maxLength={1000}
                          className="min-h-[80px] w-full resize-y rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                        />
                        <p className="mt-1 text-right text-[11px] text-[var(--muted)]">
                          {(lang === "en" ? edits.notes_en : edits.notes).length} / 1000
                        </p>
                      </div>
                      {/* Spouse relatives — edit mode */}
                      {canEditEffective && <SpouseRelativesEditor spouseId={s.spouse_id} relatives={s.relatives || []} lang={lang} onRefresh={() => router.refresh()} />}

                      {/* Remove spouse */}
                      {canEditEffective && (
                        removeSpouseConfirm === s.spouse_id ? (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="flex-1 text-sm text-[var(--maroon-deep)]">Remove {sName}?</span>
                            <button
                              type="button"
                              onClick={() => setRemoveSpouseConfirm(null)}
                              disabled={removeLoading}
                              className="rounded-[var(--r)] border border-[var(--hairline)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] disabled:opacity-50"
                            >
                              {t("cancel", lang)}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSpouse(s.spouse_id)}
                              disabled={removeLoading}
                              className="rounded-[var(--r)] bg-[var(--maroon)] px-3 py-1.5 text-xs font-medium text-[var(--ivory)] disabled:opacity-50"
                            >
                              {removeLoading ? t("saving", lang) : t("confirm", lang)}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRemoveSpouseConfirm(s.spouse_id)}
                            className="mt-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--maroon)]"
                          >
                            Remove
                          </button>
                        )
                      )}
                    </>
                  ) : (
                    <>
                      <InfoRow label={t("label_father_name", lang)} value={bi(s.father_name, s.father_name_en, lang)} />
                      <InfoRow label={t("label_birth_gotra", lang)} value={bi(s.birth_gotra, s.birth_gotra_en, lang)} />
                      <InfoRow label={t("label_education", lang)} value={bi(s.education, s.education_en, lang)} />
                      <InfoRow label={t("label_dob", lang)} value={s.dob} />
                      <InfoRow label={t("label_dom", lang)} value={s.date_of_marriage} />
                      {s.date_of_death && <InfoRow label={t("label_dod", lang)} value={s.date_of_death} />}
                      <InfoRow label={t("label_mobile", lang)} value={s.mobile} />
                      <InfoRow label={t("label_email", lang)} value={s.email} />
                      {bi(s.notes, s.notes_en, lang) && (
                        <div className="border-b border-[var(--hairline)] py-2 last:border-0">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("label_notes", lang)}</p>
                          <p className="whitespace-pre-line text-sm italic text-[var(--text-body)]">{bi(s.notes, s.notes_en, lang)}</p>
                        </div>
                      )}
                      {/* Spouse relatives — view mode */}
                      {s.relatives && s.relatives.length > 0 && (
                        <div className="mt-3 border-t border-[var(--hairline)] pt-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("section_wife_family", lang)}</p>
                          {groupRelatives(s.relatives, lang).map(([groupLabel, members]) => (
                            <div key={groupLabel} className="mb-2">
                              <p className="mb-1 text-[12px] font-semibold text-[var(--gold-deep)]">{groupLabel}</p>
                              {members.map((r) => {
                                const rName = bi(r.full_name, r.full_name_en, lang);
                                const rCity = bi(r.city, r.city_en, lang);
                                const rOccupation = bi(r.occupation, r.occupation_en, lang);
                                const rAddr = bi(r.addr, r.addr_en, lang);
                                return (
                                  <div key={r.relative_id} className="mb-1.5 py-1 last:mb-0">
                                    {rName && <p className="text-sm font-medium text-[var(--maroon-deep)]">{rName}</p>}
                                    {(rCity || rOccupation) && (
                                      <p className="text-[13px] text-[var(--muted)]">
                                        {[rCity, rOccupation].filter(Boolean).join(" · ")}
                                      </p>
                                    )}
                                    {rAddr && <p className="text-[12px] text-[var(--muted)]">{rAddr}</p>}
                                    {r.mobile && <p className="mt-0.5 text-[13px]">{renderMobiles(r.mobile)}</p>}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                </FadeIn>
              );
            })}
          </>
        )}

        {/* ── ADD WIFE (for married male members with no spouse row) ──── */}
        {canEditEffective && isMarriedMember && !memberIsFemale && spouses.length === 0 && (
          <>
            <SectionTitle>
              💑 {t("section_spouse", lang)}
            </SectionTitle>
            <FadeIn delay={0.15}>
            <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
              {!showAddWife ? (
                <button
                  onClick={() => setShowAddWife(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[var(--r)] border border-dashed border-[var(--gold)]/40 py-2.5 text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
                >
                  + {t("add_wife", lang)}
                </button>
              ) : (
                <div className="space-y-3">
                  <EditRow label={t("label_full_name", lang)} value={wifeForm.fullName} onChange={(v) => setWifeForm((p) => ({ ...p, fullName: v }))} />
                  <EditRow label={t("label_father_name", lang)} value={wifeForm.fatherName} onChange={(v) => setWifeForm((p) => ({ ...p, fatherName: v }))} />
                  <GotraSelect
                    label={t("label_birth_gotra", lang)}
                    valueHi={wifeForm.birthGotra}
                    valueEn={wifeForm.birthGotraEn}
                    onChange={(hi, en) => setWifeForm((p) => ({ ...p, birthGotra: hi, birthGotraEn: en }))}
                  />
                  <EditRow label={t("label_education", lang)} value={wifeForm.education} onChange={(v) => setWifeForm((p) => ({ ...p, education: v }))} />
                  <DateField label={t("label_dob", lang)} value={wifeForm.dob} onChange={(v) => setWifeForm((p) => ({ ...p, dob: v }))} />
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setShowAddWife(false); setWifeForm({ fullName: "", fatherName: "", birthGotra: "", birthGotraEn: "", education: "", dob: "" }); }}
                      disabled={addWifeLoading}
                      className="min-h-[44px] flex-1 rounded-[var(--r)] border border-[var(--hairline)] bg-[var(--raised)] text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)] disabled:opacity-50"
                    >
                      {t("cancel", lang)}
                    </button>
                    <button
                      onClick={handleAddWife}
                      disabled={addWifeLoading || !wifeForm.fullName.trim()}
                      className="min-h-[44px] flex-1 rounded-[var(--r)] bg-[var(--maroon)] text-sm font-medium text-[var(--ivory)] motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] active:scale-[.98] disabled:opacity-50"
                    >
                      {addWifeLoading ? t("saving", lang) : t("save", lang)}
                    </button>
                  </div>
                </div>
              )}
            </div>
            </FadeIn>
          </>
        )}

        {/* ── CHILDREN (merged: member-children + child-row children) ───── */}
        {(mergedChildren.length > 0 || (isMarriedMember && canEditEffective)) && (
          <>
            <SectionTitle>
              👶 {t("section_children", lang)}
            </SectionTitle>
            <FadeIn delay={0.2}>
            <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
              {mergedChildren.map((entry) => {
                if (entry.source === "member") {
                  // ── MEMBER-CHILD (registered, tappable) ──
                  const mc = entry.data;
                  const mcName = bi(mc.full_name, mc.full_name_en, lang);
                  const mcGender = mc.gender;
                  return (
                    <Link
                      key={mc.member_id}
                      href={`/family/${mc.member_id}`}
                      className="flex items-center gap-3 border-b border-[var(--hairline)] py-3 last:border-0 motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
                    >
                      <PhotoAvatar photoUrl={mc.photo_url} previewUrl={null} fallbackInitial={mcName?.charAt(0) || "?"} editing={false} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className={`font-display font-semibold ${mc.is_deceased ? "text-[var(--muted)]" : "text-[var(--maroon-deep)]"}`}>{mcName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-[var(--muted)]">
                          {mcGender && <span>{mcGender === "M" ? t("son", lang) : t("daughter", lang)}</span>}
                          {mcGender && mc.dob && <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--gold)] opacity-80" />}
                          {mc.dob && <span>{t("born", lang)}: {mc.dob}</span>}
                        </div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-[var(--gold)] opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  );
                }

                // ── CHILD-ROW (unregistered, inline) ──
                const c = entry.data;
                const idx = entry.idx;
                const cName = bi(c.full_name, c.full_name_en, lang);
                const cEducation = bi(c.education, c.education_en, lang);
                const edits = childEdits[idx];
                const isDaughter = c.gender?.toUpperCase() === "F";
                const isConfirming = promotingChildId === c.child_id;

                return (
                  <div key={c.child_id} className="border-b border-[var(--hairline)] py-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <PhotoAvatar
                        photoUrl={c.photo_url}
                        previewUrl={
                          editing
                            ? childPhotoRemoved[c.child_id]
                              ? null
                              : childPhotoPreviews[c.child_id] || null
                            : null
                        }
                        fallbackInitial={cName?.charAt(0) || "?"}
                        editing={editing}
                        size="sm"
                        onFileSelect={(f) =>
                          handlePhotoSelect(
                            f,
                            (file) => setChildPhotoFiles((p) => ({ ...p, [c.child_id]: file })),
                            (url) => setChildPhotoPreviews((p) => ({ ...p, [c.child_id]: url })),
                            (v) => setChildPhotoRemoved((p) => ({ ...p, [c.child_id]: v }))
                          )
                        }
                        onRemove={() => {
                          setChildPhotoRemoved((p) => ({ ...p, [c.child_id]: true }));
                          setChildPhotoFiles((p) => ({ ...p, [c.child_id]: null }));
                          setChildPhotoPreviews((p) => ({ ...p, [c.child_id]: null }));
                        }}
                      />

                      {editing ? (
                        <div className="flex-1">
                          <AutoHindiEditRow label={t("label_full_name", lang)} lang={lang} englishValue={edits.full_name_en} hindiValue={edits.full_name} onChangeActive={(v) => setChildField(idx, "full_name", v)} setHindi={(v) => setChildEdits((prev) => { const cp = [...prev]; cp[idx] = { ...cp[idx], full_name: v }; return cp; })} />
                          <EditRow label={t("label_gender", lang)} value={edits.gender} onChange={(v) => setChildPlain(idx, "gender", v)} />
                          <DateField label={t("label_dob", lang)} value={edits.dob} onChange={(v) => setChildPlain(idx, "dob", v)} />
                          <AutoHindiEditRow label={t("label_education", lang)} lang={lang} englishValue={edits.education_en} hindiValue={edits.education} onChangeActive={(v) => setChildField(idx, "education", v)} setHindi={(v) => setChildEdits((prev) => { const cp = [...prev]; cp[idx] = { ...cp[idx], education: v }; return cp; })} />
                          <AutoHindiEditRow label={t("label_occupation", lang)} lang={lang} englishValue={edits.occupation_en} hindiValue={edits.occupation} onChangeActive={(v) => setChildField(idx, "occupation", v)} setHindi={(v) => setChildEdits((prev) => { const cp = [...prev]; cp[idx] = { ...cp[idx], occupation: v }; return cp; })} />
                          <PhoneField label={t("label_mobile", lang)} value={edits.mobile} onChange={(v) => setChildPlain(idx, "mobile", v)} />
                          <EditRow label={t("label_email", lang)} value={edits.email} onChange={(v) => setChildPlain(idx, "email", v)} type="email" />
                          {/* Notes */}
                          <div className="border-b border-[var(--hairline)] py-2 last:border-0">
                            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("label_notes", lang)}</label>
                            <textarea
                              value={lang === "en" ? edits.notes_en : edits.notes}
                              onChange={(e) => {
                                const v = e.target.value;
                                setChildEdits((prev) => {
                                  const cp = [...prev];
                                  cp[idx] = { ...cp[idx], [lang === "en" ? "notes_en" : "notes"]: v };
                                  return cp;
                                });
                              }}
                              rows={4}
                              maxLength={1000}
                              className="min-h-[80px] w-full resize-y rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                            />
                            <p className="mt-1 text-right text-[11px] text-[var(--muted)]">
                              {(lang === "en" ? edits.notes_en : edits.notes).length} / 1000
                            </p>
                          </div>
                          {/* Remove child */}
                          {canEditEffective && (
                            removeChildConfirm === c.child_id ? (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="flex-1 text-sm text-[var(--maroon-deep)]">Remove {cName}?</span>
                                <button
                                  type="button"
                                  onClick={() => setRemoveChildConfirm(null)}
                                  disabled={removeLoading}
                                  className="rounded-[var(--r)] border border-[var(--hairline)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] disabled:opacity-50"
                                >
                                  {t("cancel", lang)}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteChild(c.child_id)}
                                  disabled={removeLoading}
                                  className="rounded-[var(--r)] bg-[var(--maroon)] px-3 py-1.5 text-xs font-medium text-[var(--ivory)] disabled:opacity-50"
                                >
                                  {removeLoading ? t("saving", lang) : t("confirm", lang)}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setRemoveChildConfirm(c.child_id)}
                                className="mt-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--maroon)]"
                              >
                                Remove
                              </button>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-semibold text-[var(--maroon-deep)]">{cName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-[var(--muted)]">
                            {c.gender && (
                              <span>{c.gender === "M" ? t("son", lang) : t("daughter", lang)}</span>
                            )}
                            {c.gender && c.dob && <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--gold)] opacity-80" />}
                            {c.dob && <span>{t("born", lang)}: {c.dob}</span>}
                            {(c.gender || c.dob) && cEducation && <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--gold)] opacity-80" />}
                            {cEducation && <span>{cEducation}</span>}
                          </div>
                          {bi(c.occupation, c.occupation_en, lang) && (
                            <p className="mt-1 text-[13px] text-[var(--muted)]">{t("label_occupation", lang)}: {bi(c.occupation, c.occupation_en, lang)}</p>
                          )}
                          {c.mobile && <p className="mt-0.5 text-[13px]">{renderMobiles(c.mobile)}</p>}
                          {c.email && <p className="mt-0.5 text-[13px]"><a href={`mailto:${c.email}`} className="text-[var(--gold-deep)] underline underline-offset-2 hover:text-[var(--maroon)]">{c.email}</a></p>}
                          {bi(c.notes, c.notes_en, lang) && (
                            <p className="mt-1.5 whitespace-pre-line text-[13px] italic text-[var(--text-body)]">{bi(c.notes, c.notes_en, lang)}</p>
                          )}
                          {/* Mark as married — only in view mode, when user has edit permission */}
                          {canEditEffective && !isConfirming && (
                            <button
                              onClick={() => { setPromotingChildId(c.child_id); setPromoteHusbandName(""); }}
                              className="mt-2 flex min-h-[44px] items-center rounded-[var(--r)] border border-[var(--hairline)] px-3 py-1.5 text-[13px] font-medium text-[var(--gold-deep)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
                            >
                              {t("mark_as_married", lang)}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Inline promotion confirm */}
                    {isConfirming && !editing && (
                      <div className="mt-3 rounded-[var(--r-sm)] p-4" style={{ background: "rgba(110,30,42,0.06)" }}>
                        <p className="text-sm text-[var(--maroon-deep)]">
                          {t("promote_confirm", lang).replace("{name}", cName || "")}
                        </p>
                        {isDaughter && (
                          <div className="mt-3">
                            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                              {t("husband_name_label", lang)}
                            </label>
                            <input
                              type="text"
                              value={promoteHusbandName}
                              onChange={(e) => setPromoteHusbandName(e.target.value)}
                              className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                            />
                          </div>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => { setPromotingChildId(null); setPromoteHusbandName(""); }}
                            disabled={promoteLoading}
                            className="min-h-[44px] flex-1 rounded-[var(--r)] border border-[var(--hairline)] bg-[var(--raised)] text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)] disabled:opacity-50"
                          >
                            {t("cancel", lang)}
                          </button>
                          <button
                            onClick={() => handlePromoteChild(c.child_id, isDaughter)}
                            disabled={promoteLoading}
                            className="min-h-[44px] flex-1 rounded-[var(--r)] bg-[var(--maroon)] text-sm font-medium text-[var(--ivory)] motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] active:scale-[.98] disabled:opacity-50"
                          >
                            {promoteLoading ? t("promoting", lang) : t("confirm", lang)}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {isMarriedMember && canEditEffective && !editing && (
                <div className="mt-3">
                  {!showAddChild ? (
                    <button
                      onClick={() => { setShowAddChild(true); setChildRows([{ ...emptyChildRow }]); }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-[var(--r)] border border-dashed border-[var(--gold)]/40 py-2.5 text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
                    >
                      + {t("add_child", lang)}
                    </button>
                  ) : (
                    <div className="rounded-[var(--r-sm)] border border-[var(--hairline)] p-4">
                      {childRows.map((row, ri) => (
                        <div key={ri}>
                          {ri > 0 && <div className="my-3 h-px bg-[var(--hairline)]" />}
                          <div className="relative space-y-3">
                            {childRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setChildRows((prev) => prev.filter((_, j) => j !== ri))}
                                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:text-[var(--maroon)]"
                              >
                                ✕
                              </button>
                            )}
                            <EditRow label={t("label_full_name", lang)} value={row.fullName} onChange={(v) => setChildRows((prev) => prev.map((r, j) => j === ri ? { ...r, fullName: v } : r))} />
                            <EditRow label={t("label_gender", lang)} value={row.gender} onChange={(v) => setChildRows((prev) => prev.map((r, j) => j === ri ? { ...r, gender: v } : r))} />
                            <DateField label={t("label_dob", lang)} value={row.dob} onChange={(v) => setChildRows((prev) => prev.map((r, j) => j === ri ? { ...r, dob: v } : r))} />
                            <EditRow label={t("label_education", lang)} value={row.education} onChange={(v) => setChildRows((prev) => prev.map((r, j) => j === ri ? { ...r, education: v } : r))} />
                          </div>
                        </div>
                      ))}

                      {/* Add another row */}
                      <button
                        type="button"
                        onClick={() => setChildRows((prev) => [...prev, { ...emptyChildRow }])}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--r)] border border-dashed border-[var(--gold)]/40 py-2.5 text-[13px] font-medium text-[var(--gold-deep)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
                      >
                        + {t("add_another_child", lang)}
                      </button>

                      {/* Cancel / Save all */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => { setShowAddChild(false); setChildRows([{ ...emptyChildRow }]); }}
                          disabled={addChildLoading}
                          className="min-h-[44px] flex-1 rounded-[var(--r)] border border-[var(--hairline)] bg-[var(--raised)] text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)] disabled:opacity-50"
                        >
                          {t("cancel", lang)}
                        </button>
                        <button
                          onClick={handleAddChildrenBulk}
                          disabled={addChildLoading || !childRows.some((r) => r.fullName.trim())}
                          className="min-h-[44px] flex-1 rounded-[var(--r)] bg-[var(--maroon)] text-sm font-medium text-[var(--ivory)] motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] active:scale-[.98] disabled:opacity-50"
                        >
                          {addChildLoading ? t("saving", lang) : t("save", lang)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            </FadeIn>
          </>
        )}

        {/* ── SAVE / CANCEL BAR ────────────────────────────────────────── */}
        {editing && (
          <div className="sticky bottom-0 mt-6 flex gap-3 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-lift">
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="min-h-[48px] flex-1 rounded-[var(--r)] border border-[var(--hairline)] bg-[var(--raised)] text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)] disabled:opacity-50"
            >
              {t("cancel", lang)}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="min-h-[48px] flex-1 rounded-[var(--r)] bg-[var(--maroon)] text-sm font-medium text-[var(--ivory)] motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] active:scale-[.98] disabled:opacity-50"
            >
              {saving ? t("saving", lang) : t("save", lang)}
            </button>
          </div>
        )}

        {/* ── POST-SAVE UNMARRIED PROMPT ─────────────────────────────── */}
        {showUnmarriedPrompt && !editing && (
          <FadeIn>
          <div className="mt-4 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
            <p className="mb-3 text-sm font-medium text-[var(--maroon-deep)]">
              {lang === "en"
                ? "Status changed to unmarried. Would you like to remove any related records?"
                : "स्थिति अविवाहित में बदली गई। क्या आप संबंधित रिकॉर्ड हटाना चाहेंगे?"}
            </p>

            {spouses.map((s) => {
              const sN = bi(s.full_name, s.full_name_en, lang);
              return (
                <div key={s.spouse_id} className="flex items-center justify-between border-b border-[var(--hairline)] py-2 last:border-0">
                  <span className="text-sm text-[var(--maroon-deep)]">
                    {lang === "en" ? `Remove ${sN}'s details?` : `${sN} का विवरण हटाएं?`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteSpouse(s.spouse_id)}
                    disabled={removeLoading}
                    className="rounded-[var(--r)] bg-[var(--maroon)] px-3 py-1.5 text-xs font-medium text-[var(--ivory)] disabled:opacity-50"
                  >
                    {removeLoading ? t("saving", lang) : t("confirm", lang)}
                  </button>
                </div>
              );
            })}

            {childrenData.map((c) => {
              const cN = bi(c.full_name, c.full_name_en, lang);
              return (
                <div key={c.child_id} className="flex items-center justify-between border-b border-[var(--hairline)] py-2 last:border-0">
                  <span className="text-sm text-[var(--maroon-deep)]">
                    {lang === "en" ? `Remove ${cN}?` : `${cN} को हटाएं?`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteChild(c.child_id)}
                    disabled={removeLoading}
                    className="rounded-[var(--r)] bg-[var(--maroon)] px-3 py-1.5 text-xs font-medium text-[var(--ivory)] disabled:opacity-50"
                  >
                    {removeLoading ? t("saving", lang) : t("confirm", lang)}
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setShowUnmarriedPrompt(false)}
              className="mt-3 w-full rounded-[var(--r)] border border-[var(--hairline)] py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--cream-panel)]"
            >
              {lang === "en" ? "Keep all records" : "सभी रिकॉर्ड रखें"}
            </button>
          </div>
          </FadeIn>
        )}

        {/* ── LINEAGE (view only, never editable) ──────────────────────── */}
        {!editing && (father || memberChildren.length > 0) && (
          <>
            <SectionTitle>
              🌳 {t("section_lineage", lang)}
            </SectionTitle>
            <FadeIn delay={0.25}>
            <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
              {father && (
                <div className="border-b border-[var(--hairline)] pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("label_father", lang)}</p>
                  <Link
                    href={`/family/${father.member_id}`}
                    className="mt-1 inline-flex items-center gap-1 font-display font-semibold text-[var(--maroon)] hover:text-[var(--gold-deep)]"
                  >
                    {bi(father.full_name, father.full_name_en, lang)}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--gold)] opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}

              {memberChildren.length > 0 && (
                <div className={father ? "pt-3" : ""}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("label_children_in_dir", lang)}</p>
                  <div className="mt-2 space-y-2">
                    {memberChildren.map((mc) => (
                      <Link
                        key={mc.member_id}
                        href={`/family/${mc.member_id}`}
                        className="flex items-center justify-between rounded-[var(--r)] bg-[var(--cream-panel)] p-3 motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream)]"
                      >
                        <span className="font-display font-semibold text-[var(--maroon)]">
                          {bi(mc.full_name, mc.full_name_en, lang)}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--gold)] opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            </FadeIn>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
