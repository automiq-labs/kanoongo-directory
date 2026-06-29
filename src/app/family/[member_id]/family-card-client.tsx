"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Member, Spouse, Child } from "@/lib/types";
import { useLang } from "@/lib/language-context";
import { t, type Lang } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import { createClient } from "@/lib/supabase/client";
import { validateImage, uploadPhoto, createPreviewUrl } from "@/lib/photo-utils";
import LanguageToggle from "@/app/language-toggle";
import BottomNav from "@/app/bottom-nav";
import { FadeIn } from "@/components/Motion";

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
        className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-sm text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
      />
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
}

interface ChildEdits {
  child_id: string;
  full_name: string;
  full_name_en: string;
  gender: string;
  dob: string;
  education: string;
  education_en: string;
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

/** Get edit value for active language */
function getEditVal(
  edits: Record<string, string>,
  baseField: string,
  lang: Lang
): string {
  const { activeKey } = langKeys(baseField, lang);
  return edits[activeKey] ?? "";
}

/** Set edit value for active language, auto-fill other if empty */
function setEditVal(
  edits: Record<string, string>,
  baseField: string,
  lang: Lang,
  value: string
): Record<string, string> {
  const { activeKey, otherKey } = langKeys(baseField, lang);
  const updated = { ...edits, [activeKey]: value };
  // Auto-fill other language only if it's currently empty
  if (!edits[otherKey]) {
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
  const searchParams = useSearchParams();

  // Edit state
  const [editing, setEditing] = useState(false);
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

  // Add-wife form state (for married male members)
  const [showAddWife, setShowAddWife] = useState(false);
  const [addWifeLoading, setAddWifeLoading] = useState(false);
  const [wifeForm, setWifeForm] = useState({ fullName: "", fatherName: "", birthGotra: "", education: "", dob: "" });

  // Add-children form state (multi-row, view mode, for any married member)
  const emptyChildRow = { fullName: "", gender: "", dob: "", education: "" };
  const [showAddChild, setShowAddChild] = useState(false);
  const [addChildLoading, setAddChildLoading] = useState(false);
  const [childRows, setChildRows] = useState<Array<{ fullName: string; gender: string; dob: string; education: string }>>([{ ...emptyChildRow }]);

  // Mark member as married (for unmarried members)
  const [showMarkMarried, setShowMarkMarried] = useState(false);
  const [markMarriedGender, setMarkMarriedGender] = useState<string>(m.gender || "");
  const [markMarriedLoading, setMarkMarriedLoading] = useState(false);

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
    setEditing(true);
  }

  // Auto-open edit mode when ?edit=1 is present
  useEffect(() => {
    if (searchParams.get("edit") === "1" && canEdit && !editing) {
      startEditing();
    }
  }, []); // only on mount

  function cancelEditing() {
    setEditing(false);
    setToast(null);
  }

  // ── Add husband (for married daughters without a spouse row) ────────────

  async function handleAddHusband() {
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
  }

  // ── Add children bulk (view mode, for any married member) ───────────────

  async function handleAddChildrenBulk() {
    const filledRows = childRows.filter((r) => r.fullName.trim());
    if (filledRows.length === 0) {
      setToast({ type: "error", msg: t("save_error", lang) });
      return;
    }

    setAddChildLoading(true);
    try {
      const supabase = createClient();
      const payload = filledRows.map((r) => ({
        full_name: r.fullName.trim(),
        full_name_en: r.fullName.trim(),
        gender: r.gender.trim() || null,
        dob: r.dob || null,
        education: r.education.trim() || null,
        education_en: r.education.trim() || null,
      }));

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
    setAddWifeLoading(true);
    try {
      const supabase = createClient();
      const nameVal = wifeForm.fullName.trim();
      const { error } = await supabase.rpc("add_spouse", {
        p_member_id: m.member_id,
        p_full_name: nameVal || "",
        p_full_name_en: nameVal || null,
        p_gender: "F",
        p_father_name: wifeForm.fatherName.trim() || null,
        p_father_name_en: wifeForm.fatherName.trim() || null,
        p_birth_gotra: wifeForm.birthGotra.trim() || null,
        p_birth_gotra_en: wifeForm.birthGotra.trim() || null,
        p_education: wifeForm.education.trim() || null,
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
      setWifeForm({ fullName: "", fatherName: "", birthGotra: "", education: "", dob: "" });
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
    setPromoteLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("promote_child_to_member", {
        p_child_id: childId,
        p_husband_name: isDaughter ? (promoteHusbandName.trim() || null) : null,
        p_husband_name_en: isDaughter ? (promoteHusbandName.trim() || null) : null,
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
    setSaving(true);
    setToast(null);

    try {
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
        memberEdits as unknown as Record<string, string>,
        m as unknown as Record<string, string | null>,
        ["full_name", "education", "occupation", "addr_line1", "addr_line2", "city", "gotra", "husband_name"],
        ["dob", "mobile_1", "mobile_2", "email", "pincode"]
      );
      if (memberPhotoUrl !== m.photo_url) {
        memberPayload.photo_url = memberPhotoUrl;
      }

      if (Object.keys(memberPayload).length > 0) {
        // Write edit history
        await supabase.from("edit_history").insert({
          table_name: "members",
          record_id: m.member_id,
          family_id: familyId,
          changed_by: userId,
          previous_values: m,
        });
        // Update
        const { error } = await supabase
          .from("members")
          .update(memberPayload)
          .eq("member_id", m.member_id);
        if (error) throw error;
      }

      // --- Spouses ---
      for (let i = 0; i < spouses.length; i++) {
        const s = spouses[i];
        const edits = spouseEdits[i];
        const payload = buildBilingualPayload(
          edits as unknown as Record<string, string>,
          s as unknown as Record<string, string | null>,
          ["full_name", "birth_gotra", "father_name", "education"],
          ["dob", "date_of_marriage", "mobile", "email"]
        );
        if (spousePhotoUrls[s.spouse_id] !== undefined) {
          payload.photo_url = spousePhotoUrls[s.spouse_id];
        }

        if (Object.keys(payload).length > 0) {
          await supabase.from("edit_history").insert({
            table_name: "spouses",
            record_id: s.spouse_id,
            family_id: familyId,
            changed_by: userId,
            previous_values: s,
          });
          const { error } = await supabase
            .from("spouses")
            .update(payload)
            .eq("spouse_id", s.spouse_id);
          if (error) throw error;
        }
      }

      // --- Children ---
      for (let i = 0; i < childrenData.length; i++) {
        const c = childrenData[i];
        const edits = childEdits[i];
        const payload = buildBilingualPayload(
          edits as unknown as Record<string, string>,
          c as unknown as Record<string, string | null>,
          ["full_name", "education"],
          ["gender", "dob"]
        );
        if (childPhotoUrls[c.child_id] !== undefined) {
          payload.photo_url = childPhotoUrls[c.child_id];
        }

        if (Object.keys(payload).length > 0) {
          await supabase.from("edit_history").insert({
            table_name: "children",
            record_id: c.child_id,
            family_id: familyId,
            changed_by: userId,
            previous_values: c,
          });
          const { error } = await supabase
            .from("children")
            .update(payload)
            .eq("child_id", c.child_id);
          if (error) throw error;
        }
      }

      setEditing(false);
      setToast({ type: "success", msg: t("saved", lang) });
      setTimeout(() => setToast(null), 3000);
      router.refresh(); // re-fetch server data
    } catch (err: unknown) {
      console.error("Save error:", err);
      setToast({ type: "error", msg: t("save_error", lang) });
    } finally {
      setSaving(false);
    }
  }

  // ── Derived display values ──────────────────────────────────────────────

  const name = bi(m.full_name, m.full_name_en, lang);
  const gotra = bi(m.gotra, m.gotra_en, lang);
  const education = bi(m.education, m.education_en, lang);
  const occupation = bi(m.occupation, m.occupation_en, lang);
  const city = bi(m.city, m.city_en, lang);
  const addr1 = bi(m.addr_line1, m.addr_line1_en, lang);
  const addr2 = bi(m.addr_line2, m.addr_line2_en, lang);
  const address = [addr1, addr2, city, m.pincode].filter(Boolean).join(", ");
  const husbandName = bi(m.husband_name, m.husband_name_en, lang);
  const isFemale = m.gender === "F";
  const isMarriedDaughter = m.member_id.startsWith("D");
  const isMarriedMember = m.marital_status === "married";
  const memberIsFemale = m.gender === "F" || m.gender === "female";
  // For married daughters: if a real spouse row exists, show that instead of text husband_name
  const hasRealHusbandSpouse = isMarriedDaughter && spouses.length > 0;

  // ── Merged children list (member-children + child-row children, sorted by dob) ──

  type MergedChild =
    | { source: "member"; data: MemberChild }
    | { source: "child"; data: Child; idx: number };

  const mergedChildren: MergedChild[] = [
    ...memberChildren.map((mc): MergedChild => ({ source: "member", data: mc })),
    ...childrenData.map((c, idx): MergedChild => ({ source: "child", data: c, idx })),
  ].sort((a, b) => {
    const dobA = a.data.dob || "";
    const dobB = b.data.dob || "";
    // Both have dob: sort ascending
    if (dobA && dobB) return dobA.localeCompare(dobB);
    // One has dob, the other doesn't: dob first
    if (dobA && !dobB) return -1;
    if (!dobA && dobB) return 1;
    // Neither has dob: sort by name
    const nameA = (a.data.full_name_en || a.data.full_name || "").toLowerCase();
    const nameB = (b.data.full_name_en || b.data.full_name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

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
            <PhotoAvatar
              photoUrl={m.photo_url}
              previewUrl={editing ? (memberPhotoRemoved ? null : memberPhotoPreview) : null}
              fallbackInitial={name?.charAt(0) || "?"}
              editing={editing}
              onFileSelect={(f) =>
                handlePhotoSelect(f, setMemberPhotoFile, setMemberPhotoPreview, setMemberPhotoRemoved)
              }
              onRemove={() => {
                setMemberPhotoRemoved(true);
                setMemberPhotoFile(null);
                setMemberPhotoPreview(null);
              }}
            />
            <div className="min-w-0 flex-1">
              {editing ? (
                <EditRow
                  label={t("label_full_name", lang)}
                  value={getEditVal(memberEdits as unknown as Record<string, string>, "full_name", lang)}
                  onChange={(v) => setMemberField("full_name", v)}
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
            {canEdit && !editing && (
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
              <EditRow
                label={t("label_gotra", lang)}
                value={getEditVal(memberEdits as unknown as Record<string, string>, "gotra", lang)}
                onChange={(v) => setMemberField("gotra", v)}
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
              <EditRow
                label={t("label_education", lang)}
                value={getEditVal(memberEdits as unknown as Record<string, string>, "education", lang)}
                onChange={(v) => setMemberField("education", v)}
              />
              <EditRow
                label={t("label_occupation", lang)}
                value={getEditVal(memberEdits as unknown as Record<string, string>, "occupation", lang)}
                onChange={(v) => setMemberField("occupation", v)}
              />
              <EditRow
                label={t("label_dob", lang)}
                value={memberEdits.dob}
                onChange={(v) => setMemberPlain("dob", v)}
              />
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

              {/* Mark member as married — under the marital status row */}
              {canEdit && m.marital_status !== "married" && !showMarkMarried && (
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
                  <EditRow label={t("label_mobile", lang)} value={memberEdits.mobile_1} onChange={(v) => setMemberPlain("mobile_1", v)} type="tel" />
                  <EditRow label={t("label_mobile_2", lang)} value={memberEdits.mobile_2} onChange={(v) => setMemberPlain("mobile_2", v)} type="tel" />
                  <EditRow label={t("label_email", lang)} value={memberEdits.email} onChange={(v) => setMemberPlain("email", v)} type="email" />
                  <EditRow label={t("label_addr_line1", lang)} value={getEditVal(memberEdits as unknown as Record<string, string>, "addr_line1", lang)} onChange={(v) => setMemberField("addr_line1", v)} />
                  <EditRow label={t("label_addr_line2", lang)} value={getEditVal(memberEdits as unknown as Record<string, string>, "addr_line2", lang)} onChange={(v) => setMemberField("addr_line2", v)} />
                  <EditRow label={t("label_city", lang)} value={getEditVal(memberEdits as unknown as Record<string, string>, "city", lang)} onChange={(v) => setMemberField("city", v)} />
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
                  <EditRow
                    label={t("label_husband_name", lang)}
                    value={getEditVal(memberEdits as unknown as Record<string, string>, "husband_name", lang)}
                    onChange={(v) => setMemberField("husband_name", v)}
                  />
                  {isMarriedDaughter && canEdit && (
                    <button
                      onClick={handleAddHusband}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--r)] border border-dashed border-[var(--gold)]/40 py-2.5 text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
                    >
                      + {t("add_husband_details", lang)}
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
                        <EditRow
                          label={t("label_full_name", lang)}
                          value={getEditVal(edits as unknown as Record<string, string>, "full_name", lang)}
                          onChange={(v) => setSpouseField(idx, "full_name", v)}
                        />
                      </div>
                    ) : (
                      <p className="font-display font-semibold text-[var(--maroon-deep)]">{sName}</p>
                    )}
                  </div>

                  {editing ? (
                    <>
                      <EditRow label={t("label_father_name", lang)} value={getEditVal(edits as unknown as Record<string, string>, "father_name", lang)} onChange={(v) => setSpouseField(idx, "father_name", v)} />
                      <EditRow label={t("label_birth_gotra", lang)} value={getEditVal(edits as unknown as Record<string, string>, "birth_gotra", lang)} onChange={(v) => setSpouseField(idx, "birth_gotra", v)} />
                      <EditRow label={t("label_education", lang)} value={getEditVal(edits as unknown as Record<string, string>, "education", lang)} onChange={(v) => setSpouseField(idx, "education", v)} />
                      <EditRow label={t("label_dob", lang)} value={edits.dob} onChange={(v) => setSpousePlain(idx, "dob", v)} />
                      <EditRow label={t("label_dom", lang)} value={edits.date_of_marriage} onChange={(v) => setSpousePlain(idx, "date_of_marriage", v)} />
                      <EditRow label={t("label_mobile", lang)} value={edits.mobile} onChange={(v) => setSpousePlain(idx, "mobile", v)} type="tel" />
                      <EditRow label={t("label_email", lang)} value={edits.email} onChange={(v) => setSpousePlain(idx, "email", v)} type="email" />
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
                    </>
                  )}
                </div>
                </FadeIn>
              );
            })}
          </>
        )}

        {/* ── ADD WIFE (for married male members with no spouse row) ──── */}
        {canEdit && isMarriedMember && !memberIsFemale && spouses.length === 0 && (
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
                  <EditRow label={t("label_birth_gotra", lang)} value={wifeForm.birthGotra} onChange={(v) => setWifeForm((p) => ({ ...p, birthGotra: v }))} />
                  <EditRow label={t("label_education", lang)} value={wifeForm.education} onChange={(v) => setWifeForm((p) => ({ ...p, education: v }))} />
                  <EditRow label={t("label_dob", lang)} value={wifeForm.dob} onChange={(v) => setWifeForm((p) => ({ ...p, dob: v }))} />
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setShowAddWife(false); setWifeForm({ fullName: "", fatherName: "", birthGotra: "", education: "", dob: "" }); }}
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
        {(mergedChildren.length > 0 || (isMarriedMember && canEdit)) && (
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
                          <EditRow label={t("label_full_name", lang)} value={getEditVal(edits as unknown as Record<string, string>, "full_name", lang)} onChange={(v) => setChildField(idx, "full_name", v)} />
                          <EditRow label={t("label_gender", lang)} value={edits.gender} onChange={(v) => setChildPlain(idx, "gender", v)} />
                          <EditRow label={t("label_dob", lang)} value={edits.dob} onChange={(v) => setChildPlain(idx, "dob", v)} />
                          <EditRow label={t("label_education", lang)} value={getEditVal(edits as unknown as Record<string, string>, "education", lang)} onChange={(v) => setChildField(idx, "education", v)} />
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
                          {/* Mark as married — only in view mode, when user has edit permission */}
                          {canEdit && !isConfirming && (
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
                              className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-sm text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
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
              {isMarriedMember && canEdit && !editing && (
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
                            <EditRow label={t("label_dob", lang)} value={row.dob} onChange={(v) => setChildRows((prev) => prev.map((r, j) => j === ri ? { ...r, dob: v } : r))} />
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
