"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import LanguageToggle from "@/app/language-toggle";
import { Crest } from "@/components/Crest";
import { MakerMark } from "@/components/MakerMark";
import GotraSelect from "@/components/form/GotraSelect";
import DateField from "@/components/form/DateField";
import PhoneField from "@/components/form/PhoneField";

// ── Helpers ─────────────────────────────────────────────────────────────────

function isLatin(text: string): boolean {
  const latin = text.replace(/[\s\d\W]/g, "").match(/[a-zA-Z]/g);
  return (latin?.length ?? 0) > text.replace(/[\s\d\W]/g, "").length / 2;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ParentCandidate {
  member_id: string;
  full_name: string;
  full_name_en: string | null;
  city: string | null;
  city_en: string | null;
  match_score: number;
}

interface SelfMatch {
  member_id: string;
  full_name: string;
  full_name_en: string | null;
  city: string | null;
  city_en: string | null;
  marital_status: string | null;
  already_claimed: boolean;
  match_score: number;
  source: "member" | "child";
  match_id: string;
}

interface SpouseMatch {
  spouse_id: string;
  full_name: string;
  full_name_en: string | null;
  father_name: string | null;
  father_name_en: string | null;
  already_claimed: boolean;
  match_score: number;
}

type Step =
  | "code"
  | "name"
  | "relation"
  | "parent"
  | "confirm_self"
  | "husband"
  | "confirm_spouse"
  | "account";

// ── Step indicator ──────────────────────────────────────────────────────────

function StepDots({
  current,
  total,
  direction = "horizontal",
}: {
  current: number;
  total: number;
  direction?: "horizontal" | "vertical";
}) {
  const isV = direction === "vertical";
  return (
    <div className={`flex ${isV ? "flex-col items-center gap-3" : "justify-center gap-2"}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full motion-safe:transition-all motion-safe:duration-[var(--dur)] ${
            i === current
              ? isV
                ? "h-3 w-3 bg-[var(--gold)]"
                : "h-2 w-6 bg-[var(--gold)]"
              : i < current
                ? `${isV ? "h-2.5 w-2.5" : "h-2 w-2"} bg-[var(--gold)]`
                : `${isV ? "h-2 w-2" : "h-2 w-2"} bg-[var(--gold)]/20`
          }`}
        />
      ))}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { lang } = useLang();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Flow state
  const [step, setStep] = useState<Step>("code");
  const [error, setError] = useState("");
  const [relation, setRelation] = useState<"birth" | "wife" | null>(null);

  // Step 1 — code
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  // Step 2 — name
  const [fullName, setFullName] = useState("");

  // Step 3a — parent search (birth path)
  const [parentQuery, setParentQuery] = useState("");
  const [parentResults, setParentResults] = useState<ParentCandidate[]>([]);
  const [parentSearching, setParentSearching] = useState(false);
  const [parentSearchDone, setParentSearchDone] = useState(false);
  const [selectedParent, setSelectedParent] = useState<ParentCandidate | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3a cont — self match (birth path)
  const [selfMatches, setSelfMatches] = useState<SelfMatch[]>([]);
  const [claimMemberId, setClaimMemberId] = useState<string | null>(null);

  // Step 3b — husband search (wife path)
  const [husbandQuery, setHusbandQuery] = useState("");
  const [husbandResults, setHusbandResults] = useState<ParentCandidate[]>([]);
  const [husbandSearching, setHusbandSearching] = useState(false);
  const [husbandSearchDone, setHusbandSearchDone] = useState(false);
  const [selectedHusband, setSelectedHusband] = useState<ParentCandidate | null>(null);
  const husbandDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3b cont — spouse match (wife path)
  const [spouseMatches, setSpouseMatches] = useState<SpouseMatch[]>([]);
  const [claimSpouseId, setClaimSpouseId] = useState<string | null>(null);

  // Step 4 — account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState<string>("");
  const [regGotra, setRegGotra] = useState("");
  const [regGotraEn, setRegGotraEn] = useState("");
  const [regDob, setRegDob] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [creating, setCreating] = useState(false);
  const [emailConfirmNeeded, setEmailConfirmNeeded] = useState(false);

  // Step index for dots (5 logical steps: code, name, relation, search+match, account)
  const stepIndex: number = {
    code: 0,
    name: 1,
    relation: 2,
    parent: 3,
    confirm_self: 3,
    husband: 3,
    confirm_spouse: 3,
    account: 4,
  }[step];

  // ── Step 1 — validate code ───────────────────────────────────────────────

  async function handleCodeSubmit() {
    setError("");
    setCodeLoading(true);
    try {
      const { data } = await supabase.rpc("validate_invite_code", { p_code: code.trim() });
      if (data === true) {
        setStep("name");
      } else {
        setError(t("reg_code_wrong", lang));
      }
    } catch {
      setError(t("reg_code_wrong", lang));
    } finally {
      setCodeLoading(false);
    }
  }

  // ── Step 2 — name → relation choice ──────────────────────────────────────

  function handleNameNext() {
    if (!fullName.trim()) return;
    setStep("relation");
  }

  // ── Step 2b — relation choice ────────────────────────────────────────────

  function handleRelationChoice(r: "birth" | "wife") {
    setRelation(r);
    if (r === "birth") {
      setStep("parent");
    } else {
      setStep("husband");
    }
  }

  // ── Step 3a — parent search (birth path, debounced) ──────────────────────

  const searchParent = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setParentResults([]);
        setParentSearchDone(false);
        return;
      }
      setParentSearching(true);
      const { data, error } = await supabase.rpc("search_parent_fuzzy", { q: q.trim(), p_invite_code: code.trim() });
      if (error) console.error("search_parent_fuzzy error:", error);
      setParentResults((data as ParentCandidate[]) || []);
      setParentSearching(false);
      setParentSearchDone(true);
    },
    [supabase, code]
  );

  useEffect(() => {
    if (step !== "parent") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchParent(parentQuery), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [parentQuery, step, searchParent]);

  async function handleParentSelect(parent: ParentCandidate) {
    setSelectedParent(parent);
    setError("");

    const { data: matches, error: rpcErr } = await supabase.rpc(
      "find_matching_children",
      { p_parent_member_id: parent.member_id, q: fullName.trim(), p_invite_code: code.trim() }
    );
    if (rpcErr) console.error("find_matching_children error:", rpcErr);

    if (matches && (matches as SelfMatch[]).length > 0) {
      setSelfMatches(matches as SelfMatch[]);
      setClaimMemberId(null);
      setStep("confirm_self");
      return;
    }

    setClaimMemberId(null);
    setStep("account");
  }

  function handleSkipParent() {
    setSelectedParent(null);
    setClaimMemberId(null);
    setStep("account");
  }

  function handleClaimSelf(matchId: string) {
    setClaimMemberId(matchId);
    setStep("account");
  }

  function handleNewSelf() {
    setClaimMemberId(null);
    setStep("account");
  }

  // ── Step 3b — husband search (wife path, debounced) ──────────────────────

  const searchHusband = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setHusbandResults([]);
        setHusbandSearchDone(false);
        return;
      }
      setHusbandSearching(true);
      const { data, error } = await supabase.rpc("search_parent_fuzzy", { q: q.trim(), p_invite_code: code.trim() });
      if (error) console.error("search_parent_fuzzy error:", error);
      setHusbandResults((data as ParentCandidate[]) || []);
      setHusbandSearching(false);
      setHusbandSearchDone(true);
    },
    [supabase, code]
  );

  useEffect(() => {
    if (step !== "husband") return;
    if (husbandDebounceRef.current) clearTimeout(husbandDebounceRef.current);
    husbandDebounceRef.current = setTimeout(() => searchHusband(husbandQuery), 350);
    return () => { if (husbandDebounceRef.current) clearTimeout(husbandDebounceRef.current); };
  }, [husbandQuery, step, searchHusband]);

  async function handleHusbandSelect(husband: ParentCandidate) {
    setSelectedHusband(husband);
    setError("");

    const { data: matches, error: rpcErr } = await supabase.rpc(
      "find_matching_spouses",
      { p_husband_member_id: husband.member_id, q: fullName.trim(), p_invite_code: code.trim() }
    );
    if (rpcErr) console.error("find_matching_spouses error:", rpcErr);

    if (matches && (matches as SpouseMatch[]).length > 0) {
      setSpouseMatches(matches as SpouseMatch[]);
      setClaimSpouseId(null);
      setStep("confirm_spouse");
      return;
    }

    // No spouse match — go to create-new
    setClaimSpouseId(null);
    setStep("account");
  }

  function handleSkipHusband() {
    setSelectedHusband(null);
    setClaimSpouseId(null);
    setStep("account");
  }

  function handleClaimSpouse(spouseId: string) {
    setClaimSpouseId(spouseId);
    setStep("account");
  }

  function handleNewSpouse() {
    setClaimSpouseId(null);
    setStep("account");
  }

  // ── Step 4 — create account ───────────────────────────────────────────────

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(t("reg_password_short", lang));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("reg_password_mismatch", lang));
      return;
    }

    setCreating(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setCreating(false);
        return;
      }

      let session = signUpData.session;
      if (!session) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) {
          setEmailConfirmNeeded(true);
          setCreating(false);
          return;
        }
        session = signInData.session;
      }

      if (!session) {
        setEmailConfirmNeeded(true);
        setCreating(false);
        return;
      }

      const nameTrimmed = fullName.trim();
      const p_name = nameTrimmed;
      const p_name_en = isLatin(nameTrimmed) ? nameTrimmed : null;

      const { error: rpcError } = await supabase.rpc("complete_registration", {
        p_name,
        p_name_en: p_name_en || null,
        p_parent_member_id: selectedParent?.member_id || selectedHusband?.member_id || null,
        p_claim_member_id: claimMemberId || null,
        p_claim_spouse_id: claimSpouseId || null,
        p_invite_code: code.trim(),
      });

      if (rpcError) {
        console.error("complete_registration failed:", rpcError);
        if (rpcError.message.includes("invalid_invite_code")) {
          setError(t("reg_code_wrong", lang));
          setStep("code");
        } else {
          setError(t("reg_signup_error", lang));
        }
        setCreating(false);
        return;
      }

      // Set optional fields on the newly created member (new-member path only, not claims)
      if (!claimMemberId && !claimSpouseId) {
        try {
          const optPayload: Record<string, string> = {};
          if (gender) optPayload.gender = gender;
          if (regGotra) optPayload.gotra = regGotra;
          if (regGotraEn) optPayload.gotra_en = regGotraEn;
          if (regDob) optPayload.dob = regDob;
          if (regMobile) optPayload.mobile_1 = regMobile;
          if (Object.keys(optPayload).length > 0) {
            const { data: fam } = await supabase
              .from("families")
              .select("head_member_id")
              .eq("auth_user_id", session.user.id)
              .single();
            if (fam?.head_member_id) {
              await supabase
                .from("members")
                .update(optPayload)
                .eq("member_id", fam.head_member_id);
            }
          }
        } catch {
          // Best-effort; don't block registration
        }
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Registration error:", err);
      setError(t("reg_signup_error", lang));
    } finally {
      setCreating(false);
    }
  }

  // ── Back navigation ───────────────────────────────────────────────────────

  function handleBack() {
    setError("");
    switch (step) {
      case "name": setStep("code"); break;
      case "relation": setStep("name"); break;
      case "parent": setStep("relation"); break;
      case "confirm_self": setStep("parent"); break;
      case "husband": setStep("relation"); break;
      case "confirm_spouse": setStep("husband"); break;
      case "account":
        if (relation === "wife") {
          if (spouseMatches.length > 0 && selectedHusband) setStep("confirm_spouse");
          else setStep("husband");
        } else {
          if (selfMatches.length > 0 && selectedParent) setStep("confirm_self");
          else setStep("parent");
        }
        break;
    }
  }

  // ── Shared class strings ─────────────────────────────────────────────────

  const inputClass =
    "min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-4 py-3 text-base text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none";

  const primaryBtn =
    "min-h-[48px] w-full rounded-[var(--r)] bg-[var(--maroon)] text-base font-medium text-[var(--ivory)] motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] active:scale-[.98] disabled:opacity-50";

  const secondaryBtn =
    "min-h-[44px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-[var(--raised)] py-3 text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]";

  const cardClass =
    "fade-up rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-6 shadow-card";

  const resultCardClass =
    "flex w-full items-center gap-3 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-3.5 text-left shadow-card motion-safe:transition-[transform,box-shadow] motion-safe:duration-[var(--dur)] motion-safe:[transition-timing-function:var(--ease-out)] hover:-translate-y-[2px] hover:shadow-lift active:scale-[.98]";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-[var(--paper)]">
      {/* Entrance animation */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .fade-up { animation: fadeUp var(--dur) var(--ease-out) both; }
        }
      `}</style>

      {/* ── LEFT PANEL — desktop only ─────────────────────────────── */}
      <div
        className="hidden md:flex md:w-[45%] md:flex-col md:items-center md:justify-center md:px-10"
        style={{ background: "linear-gradient(180deg, #33121a, var(--ink))" }}
      >
        <div className="relative mb-6 flex items-center justify-center">
          <div
            className="absolute h-[130px] w-[130px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(201,150,46,0.12) 0%, transparent 70%)" }}
          />
          <Crest size={100} />
        </div>
        <h1 className="mb-2 text-center font-display text-3xl font-semibold text-[#F4E3C1]">
          {t("reg_title", lang)}
        </h1>
        <p className="mb-8 text-sm" style={{ color: "rgba(201,150,46,0.55)" }}>
          {t("app_title", lang)}
        </p>
        <StepDots current={stepIndex} total={5} direction="vertical" />
      </div>

      {/* ── RIGHT PANEL / MOBILE COLUMN ───────────────────────────── */}
      <div
        className="flex flex-1 flex-col"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-2 md:px-8">
          {step !== "code" && !emailConfirmNeeded ? (
            <button
              onClick={handleBack}
              className="flex min-h-[36px] items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--maroon)]"
            >
              ← {t("reg_back", lang)}
            </button>
          ) : (
            <div />
          )}
          <LanguageToggle variant="page" />
        </div>

        {/* Mobile crest + title + dots */}
        <div className="mb-6 text-center md:hidden">
          <div className="relative mx-auto mb-3 flex w-fit items-center justify-center">
            <div
              className="absolute h-[80px] w-[80px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(201,150,46,0.10) 0%, transparent 70%)" }}
            />
            <Crest size={56} />
          </div>
          <h1 className="mb-1 font-display text-xl font-semibold text-[var(--maroon)]">
            {t("reg_title", lang)}
          </h1>
          <div className="mt-3">
            <StepDots current={stepIndex} total={5} />
          </div>
        </div>

        {/* Step content */}
        <div className="flex flex-1 flex-col items-center px-5 pb-6 md:justify-center md:px-8">
          <div className="w-full max-w-[400px]">

            {/* ── STEP: CODE ─────────────────────────────────────────── */}
            {step === "code" && (
              <div className={cardClass}>
                <h2 className="mb-1 text-lg font-semibold text-[var(--maroon-deep)]">
                  {t("reg_step_code_title", lang)}
                </h2>
                <p className="mb-5 text-sm text-[var(--muted)]">{t("reg_step_code_hint", lang)}</p>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {t("reg_code_placeholder", lang)}
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setError(""); }}
                  placeholder={t("reg_code_placeholder", lang)}
                  className={inputClass}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && code.trim() && handleCodeSubmit()}
                />
                {error && (
                  <div className="mt-3 rounded-[var(--r-sm)] px-4 py-3 text-sm font-medium text-[var(--maroon-deep)]" style={{ background: "rgba(110,30,42,0.06)" }}>
                    {error}
                  </div>
                )}
                <button onClick={handleCodeSubmit} disabled={!code.trim() || codeLoading} className={`mt-5 ${primaryBtn}`}>
                  {codeLoading ? t("reg_checking", lang) : t("reg_next", lang)}
                </button>
              </div>
            )}

            {/* ── STEP: NAME ─────────────────────────────────────────── */}
            {step === "name" && (
              <div className={cardClass}>
                <h2 className="mb-5 text-lg font-semibold text-[var(--maroon-deep)]">
                  {t("reg_step_name_title", lang)}
                </h2>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {t("reg_name_placeholder", lang)}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("reg_name_placeholder", lang)}
                  className={inputClass}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && fullName.trim() && handleNameNext()}
                />
                <button onClick={handleNameNext} disabled={!fullName.trim()} className={`mt-5 ${primaryBtn}`}>
                  {t("reg_next", lang)}
                </button>
              </div>
            )}

            {/* ── STEP: RELATION CHOICE ──────────────────────────────── */}
            {step === "relation" && (
              <div className={cardClass}>
                <h2 className="mb-5 text-lg font-semibold text-[var(--maroon-deep)]">
                  {t("reg_relation_title", lang)}
                </h2>
                <div className="space-y-3">
                  <button
                    onClick={() => handleRelationChoice("birth")}
                    className="flex w-full items-center gap-3 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 text-left shadow-card motion-safe:transition-[transform,box-shadow] motion-safe:duration-[var(--dur)] motion-safe:[transition-timing-function:var(--ease-out)] hover:-translate-y-[3px] hover:shadow-lift active:scale-[.98]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--cream-panel)] text-lg">
                      👨‍👩‍👧
                    </span>
                    <span className="font-medium text-[var(--maroon-deep)]">
                      {t("reg_relation_birth", lang)}
                    </span>
                  </button>
                  <button
                    onClick={() => handleRelationChoice("wife")}
                    className="flex w-full items-center gap-3 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 text-left shadow-card motion-safe:transition-[transform,box-shadow] motion-safe:duration-[var(--dur)] motion-safe:[transition-timing-function:var(--ease-out)] hover:-translate-y-[3px] hover:shadow-lift active:scale-[.98]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--cream-panel)] text-lg">
                      💑
                    </span>
                    <span className="font-medium text-[var(--maroon-deep)]">
                      {t("reg_relation_wife", lang)}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: PARENT (birth path) ──────────────────────────── */}
            {step === "parent" && (
              <div className={cardClass}>
                <h2 className="mb-1 text-lg font-semibold text-[var(--maroon-deep)]">
                  {t("reg_step_parent_title", lang)}
                </h2>
                <p className="mb-5 text-sm text-[var(--muted)]">{t("reg_step_parent_hint", lang)}</p>
                <input
                  type="text"
                  value={parentQuery}
                  onChange={(e) => { setParentQuery(e.target.value); setParentSearchDone(false); }}
                  placeholder={t("reg_parent_placeholder", lang)}
                  className={inputClass}
                  autoFocus
                />
                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                  {parentSearching && <p className="py-3 text-center text-sm text-[var(--muted)]">{t("reg_checking", lang)}</p>}
                  {!parentSearching && parentSearchDone && parentResults.length === 0 && parentQuery.trim().length >= 2 && (
                    <p className="py-3 text-center text-sm text-[var(--muted)]">{t("reg_parent_no_results", lang)}</p>
                  )}
                  {parentResults.map((p) => {
                    const pName = bi(p.full_name, p.full_name_en, lang);
                    const pCity = bi(p.city, p.city_en, lang);
                    return (
                      <button key={p.member_id} onClick={() => handleParentSelect(p)} className={resultCardClass}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] bg-[var(--cream-panel)] font-display text-base font-bold text-[var(--maroon)]">{pName?.charAt(0) || "?"}</div>
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-[var(--maroon-deep)]">{pName}</p>
                          {pCity && <p className="text-[13px] text-[var(--muted)]">{pCity}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button onClick={handleSkipParent} className={`mt-5 ${secondaryBtn}`}>
                  {t("reg_parent_skip", lang)}
                </button>
              </div>
            )}

            {/* ── STEP: CONFIRM SELF (birth path) ────────────────────── */}
            {step === "confirm_self" && (
              <div className={cardClass}>
                <h2 className="mb-1 text-lg font-semibold text-[var(--maroon-deep)]">{t("reg_is_this_you", lang)}</h2>
                <p className="mb-5 text-sm text-[var(--muted)]">{t("reg_is_this_you_hint", lang)}</p>
                <div className="space-y-2">
                  {selfMatches.map((m) => {
                    const mName = bi(m.full_name, m.full_name_en, lang);
                    const mCity = bi(m.city, m.city_en, lang);

                    if (m.already_claimed) {
                      return (
                        <div key={m.match_id} className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--cream-panel)] p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] bg-[var(--cream-panel)] font-display text-lg font-bold text-[var(--maroon)]">{mName?.charAt(0) || "?"}</div>
                            <div className="min-w-0 flex-1">
                              <p className="font-display font-semibold text-[var(--maroon-deep)]">{mName}</p>
                              {mCity && <p className="text-[13px] text-[var(--muted)]">{mCity}</p>}
                            </div>
                          </div>
                          <div className="mt-3 rounded-[var(--r-sm)] p-3" style={{ background: "rgba(110,30,42,0.06)" }}>
                            <p className="text-sm font-medium text-[var(--maroon)]">{t("reg_already_claimed", lang)}</p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">{t("reg_already_claimed_hint", lang)}</p>
                            <div className="mt-2 flex gap-3">
                              <Link href="/login" className="text-sm font-medium text-[var(--maroon)] underline-offset-2 hover:underline hover:decoration-[var(--gold)]">{t("reg_go_to_login", lang)}</Link>
                              <Link href="/reset-password" className="text-sm font-medium text-[var(--muted)] underline-offset-2 hover:underline hover:decoration-[var(--gold)]">{t("reg_forgot_password", lang)}</Link>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button key={m.match_id} onClick={() => handleClaimSelf(m.match_id)} className={resultCardClass}>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] bg-[var(--cream-panel)] font-display text-lg font-bold text-[var(--maroon)]">{mName?.charAt(0) || "?"}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-semibold text-[var(--maroon-deep)]">{mName}</p>
                          {mCity && <p className="text-[13px] text-[var(--muted)]">{mCity}</p>}
                        </div>
                        <span className="shrink-0 text-xs font-medium text-[var(--gold-deep)]">{t("reg_yes_thats_me", lang)} →</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={handleNewSelf} className={`mt-5 ${secondaryBtn}`}>{t("reg_no_im_new", lang)}</button>
              </div>
            )}

            {/* ── STEP: HUSBAND (wife path) ──────────────────────────── */}
            {step === "husband" && (
              <div className={cardClass}>
                <h2 className="mb-1 text-lg font-semibold text-[var(--maroon-deep)]">
                  {t("reg_husband_title", lang)}
                </h2>
                <p className="mb-5 text-sm text-[var(--muted)]">{t("reg_husband_hint", lang)}</p>
                <input
                  type="text"
                  value={husbandQuery}
                  onChange={(e) => { setHusbandQuery(e.target.value); setHusbandSearchDone(false); }}
                  placeholder={t("reg_husband_placeholder", lang)}
                  className={inputClass}
                  autoFocus
                />
                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                  {husbandSearching && <p className="py-3 text-center text-sm text-[var(--muted)]">{t("reg_checking", lang)}</p>}
                  {!husbandSearching && husbandSearchDone && husbandResults.length === 0 && husbandQuery.trim().length >= 2 && (
                    <p className="py-3 text-center text-sm text-[var(--muted)]">{t("reg_parent_no_results", lang)}</p>
                  )}
                  {husbandResults.map((h) => {
                    const hName = bi(h.full_name, h.full_name_en, lang);
                    const hCity = bi(h.city, h.city_en, lang);
                    return (
                      <button key={h.member_id} onClick={() => handleHusbandSelect(h)} className={resultCardClass}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] bg-[var(--cream-panel)] font-display text-base font-bold text-[var(--maroon)]">{hName?.charAt(0) || "?"}</div>
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-[var(--maroon-deep)]">{hName}</p>
                          {hCity && <p className="text-[13px] text-[var(--muted)]">{hCity}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button onClick={handleSkipHusband} className={`mt-5 ${secondaryBtn}`}>
                  {t("reg_parent_skip", lang)}
                </button>
              </div>
            )}

            {/* ── STEP: CONFIRM SPOUSE (wife path) ───────────────────── */}
            {step === "confirm_spouse" && (
              <div className={cardClass}>
                <h2 className="mb-1 text-lg font-semibold text-[var(--maroon-deep)]">{t("reg_is_this_you", lang)}</h2>
                <p className="mb-5 text-sm text-[var(--muted)]">{t("reg_is_this_you_hint", lang)}</p>
                <div className="space-y-2">
                  {spouseMatches.map((s) => {
                    const sName = bi(s.full_name, s.full_name_en, lang);
                    const sFather = bi(s.father_name, s.father_name_en, lang);

                    if (s.already_claimed) {
                      return (
                        <div key={s.spouse_id} className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--cream-panel)] p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] bg-[var(--cream-panel)] font-display text-lg font-bold text-[var(--maroon)]">{sName?.charAt(0) || "?"}</div>
                            <div className="min-w-0 flex-1">
                              <p className="font-display font-semibold text-[var(--maroon-deep)]">{sName}</p>
                              {sFather && <p className="text-[13px] text-[var(--muted)]">{t("reg_spouse_father", lang)}: {sFather}</p>}
                            </div>
                          </div>
                          <div className="mt-3 rounded-[var(--r-sm)] p-3" style={{ background: "rgba(110,30,42,0.06)" }}>
                            <p className="text-sm font-medium text-[var(--maroon)]">{t("reg_already_claimed", lang)}</p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">{t("reg_already_claimed_hint", lang)}</p>
                            <div className="mt-2 flex gap-3">
                              <Link href="/login" className="text-sm font-medium text-[var(--maroon)] underline-offset-2 hover:underline hover:decoration-[var(--gold)]">{t("reg_go_to_login", lang)}</Link>
                              <Link href="/reset-password" className="text-sm font-medium text-[var(--muted)] underline-offset-2 hover:underline hover:decoration-[var(--gold)]">{t("reg_forgot_password", lang)}</Link>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button key={s.spouse_id} onClick={() => handleClaimSpouse(s.spouse_id)} className={resultCardClass}>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] bg-[var(--cream-panel)] font-display text-lg font-bold text-[var(--maroon)]">{sName?.charAt(0) || "?"}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-semibold text-[var(--maroon-deep)]">{sName}</p>
                          {sFather && <p className="text-[13px] text-[var(--muted)]">{t("reg_spouse_father", lang)}: {sFather}</p>}
                        </div>
                        <span className="shrink-0 text-xs font-medium text-[var(--gold-deep)]">{t("reg_yes_thats_me", lang)} →</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={handleNewSpouse} className={`mt-5 ${secondaryBtn}`}>{t("reg_no_im_new", lang)}</button>
              </div>
            )}

            {/* ── STEP: ACCOUNT ──────────────────────────────────────── */}
            {step === "account" && !emailConfirmNeeded && (
              <form onSubmit={handleCreateAccount} className={cardClass}>
                <h2 className="mb-5 text-lg font-semibold text-[var(--maroon-deep)]">
                  {t("reg_step_account_title", lang)}
                </h2>
                {/* Optional fields — only on new-member path (not claiming) */}
                {!claimMemberId && !claimSpouseId && (
                  <>
                    <div className="mb-5">
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("label_gender", lang)}</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setGender("M")}
                          className={`min-h-[44px] flex-1 rounded-[var(--r)] text-sm font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                            gender === "M"
                              ? "bg-[var(--maroon)] text-[var(--ivory)]"
                              : "border border-[#ECE0C8] bg-[var(--raised)] text-[var(--maroon)] hover:bg-[var(--cream-panel)]"
                          }`}
                        >
                          {t("male", lang)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setGender("F")}
                          className={`min-h-[44px] flex-1 rounded-[var(--r)] text-sm font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                            gender === "F"
                              ? "bg-[var(--maroon)] text-[var(--ivory)]"
                              : "border border-[#ECE0C8] bg-[var(--raised)] text-[var(--maroon)] hover:bg-[var(--cream-panel)]"
                          }`}
                        >
                          {t("female", lang)}
                        </button>
                      </div>
                    </div>
                    <div className="mb-5">
                      <GotraSelect
                        label={t("label_gotra", lang)}
                        valueHi={regGotra}
                        valueEn={regGotraEn}
                        onChange={(hi, en) => { setRegGotra(hi); setRegGotraEn(en); }}
                      />
                    </div>
                    <div className="mb-5">
                      <DateField
                        label={t("label_dob", lang)}
                        value={regDob}
                        onChange={setRegDob}
                      />
                    </div>
                    <div className="mb-5">
                      <PhoneField
                        label={t("label_mobile", lang)}
                        value={regMobile}
                        onChange={setRegMobile}
                      />
                    </div>
                  </>
                )}

                <div className="mb-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("email", lang)}</label>
                  <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className={inputClass} placeholder="email@example.com" autoFocus />
                </div>
                <div className="mb-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("password", lang)}</label>
                  <input type="password" required value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className={inputClass} placeholder="••••••••" />
                </div>
                <div className="mb-5">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{t("reg_confirm_password", lang)}</label>
                  <input type="password" required value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} className={inputClass} placeholder="••••••••" />
                </div>
                {error && (
                  <div className="mb-4 rounded-[var(--r-sm)] px-4 py-3 text-sm font-medium text-[var(--maroon-deep)]" style={{ background: "rgba(110,30,42,0.06)" }}>
                    {error}
                  </div>
                )}
                <button type="submit" disabled={creating} className={primaryBtn}>
                  {creating ? t("reg_creating", lang) : t("reg_create_account", lang)}
                </button>
              </form>
            )}

            {/* ── EMAIL CONFIRMATION ─────────────────────────────────── */}
            {emailConfirmNeeded && (
              <div className={`${cardClass} text-center`}>
                <div className="mx-auto mb-4 flex justify-center"><Crest size={56} /></div>
                <h2 className="mb-2 text-lg font-semibold text-[var(--maroon-deep)]">{t("reg_email_confirm", lang)}</h2>
                <Link href="/login" className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-[var(--r)] bg-[var(--maroon)] px-6 font-medium text-[var(--ivory)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)]">{t("login_button", lang)}</Link>
              </div>
            )}

            {/* Bottom link */}
            {!emailConfirmNeeded && (
              <p className="mt-6 text-center">
                <Link href="/login" className="flex min-h-[44px] items-center justify-center text-sm font-medium text-[var(--maroon)] underline-offset-2 hover:underline hover:decoration-[var(--gold)]">{t("reg_have_account", lang)}</Link>
              </p>
            )}
          </div>
        </div>

        <MakerMark />
      </div>
    </div>
  );
}
