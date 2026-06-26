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

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Detect if text is primarily Latin script */
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
}

type Step = "code" | "name" | "parent" | "confirm_self" | "account";

// ── Step indicator ──────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6 flex justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === current
              ? "w-6 bg-[var(--maroon)]"
              : i < current
                ? "w-2 bg-[var(--gold)]"
                : "w-2 bg-[var(--border-warm)]"
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
  // Stable reference — createClient() from @supabase/ssr returns a singleton per browser,
  // but wrapping in useMemo ensures the reference is stable across renders so useCallback
  // dependencies don't thrash.
  const supabase = useMemo(() => createClient(), []);

  // Flow state
  const [step, setStep] = useState<Step>("code");
  const [error, setError] = useState("");

  // Step 1 — code
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  // Step 2 — name
  const [fullName, setFullName] = useState("");

  // Step 3 — parent
  const [parentQuery, setParentQuery] = useState("");
  const [parentResults, setParentResults] = useState<ParentCandidate[]>([]);
  const [parentSearching, setParentSearching] = useState(false);
  const [parentSearchDone, setParentSearchDone] = useState(false);
  const [selectedParent, setSelectedParent] = useState<ParentCandidate | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3b — self match
  const [selfMatches, setSelfMatches] = useState<SelfMatch[]>([]);
  const [claimMemberId, setClaimMemberId] = useState<string | null>(null);

  // Step 4 — account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [emailConfirmNeeded, setEmailConfirmNeeded] = useState(false);

  // Step number for dots
  const stepIndex = { code: 0, name: 1, parent: 2, confirm_self: 2, account: 3 }[step];

  // ── Step 1 — validate code ───────────────────────────────────────────────

  async function handleCodeSubmit() {
    setError("");
    setCodeLoading(true);
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "invite_code")
        .single();

      if (data?.value === code.trim()) {
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

  // ── Step 2 — name → parent ───────────────────────────────────────────────

  function handleNameNext() {
    if (!fullName.trim()) return;
    setStep("parent");
  }

  // ── Step 3 — parent search (debounced) ────────────────────────────────────

  const searchParent = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setParentResults([]);
        setParentSearchDone(false);
        return;
      }
      setParentSearching(true);
      const { data, error } = await supabase.rpc("search_parent_fuzzy", { q: q.trim() });
      if (error) {
        console.error("search_parent_fuzzy error:", error);
      }
      setParentResults((data as ParentCandidate[]) || []);
      setParentSearching(false);
      setParentSearchDone(true);
    },
    [supabase]
  );

  useEffect(() => {
    if (step !== "parent") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchParent(parentQuery), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [parentQuery, step, searchParent]);

  async function handleParentSelect(parent: ParentCandidate) {
    setSelectedParent(parent);
    setError("");

    // Use the DB function to find matching children under this parent
    const { data: matches, error: rpcErr } = await supabase.rpc(
      "find_matching_children",
      {
        p_parent_member_id: parent.member_id,
        q: fullName.trim(),
      }
    );

    if (rpcErr) {
      console.error("find_matching_children error:", rpcErr);
    }

    if (matches && (matches as SelfMatch[]).length > 0) {
      setSelfMatches(matches as SelfMatch[]);
      setClaimMemberId(null);
      setStep("confirm_self");
      return;
    }

    // No matches — go straight to account creation
    setClaimMemberId(null);
    setStep("account");
  }

  function handleSkipParent() {
    setSelectedParent(null);
    setClaimMemberId(null);
    setStep("account");
  }

  // ── Step 3b — self match ──────────────────────────────────────────────────

  function handleClaimSelf(memberId: string) {
    setClaimMemberId(memberId);
    setStep("account");
  }

  function handleNewSelf() {
    setClaimMemberId(null);
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
      // 1. Sign up
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setCreating(false);
        return;
      }

      // 2. Ensure we have an active session before calling the RPC.
      //    With email confirmation OFF, signUp returns a session immediately.
      //    If not, fall back to an explicit sign-in.
      let session = signUpData.session;
      if (!session) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (signInError) {
          // Likely email confirmation is required
          setEmailConfirmNeeded(true);
          setCreating(false);
          return;
        }
        session = signInData.session;
      }

      if (!session) {
        // Still no session — email confirmation must be required
        setEmailConfirmNeeded(true);
        setCreating(false);
        return;
      }

      // 3. Session is active. Complete registration — link to family tree.
      const nameTrimmed = fullName.trim();
      const p_name = nameTrimmed;
      const p_name_en = isLatin(nameTrimmed) ? nameTrimmed : null;

      const { error: rpcError } = await supabase.rpc("complete_registration", {
        p_name,
        p_name_en: p_name_en || null,
        p_parent_member_id: selectedParent?.member_id || null,
        p_claim_member_id: claimMemberId || null,
      });

      if (rpcError) {
        console.error("complete_registration failed:", rpcError);
        setError(t("reg_signup_error", lang));
        setCreating(false);
        return;
      }

      // 4. Only now redirect — registration is fully linked.
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Registration error:", err);
      setError(t("reg_signup_error", lang));
    } finally {
      setCreating(false);
    }
  }

  // ── Shared UI pieces ──────────────────────────────────────────────────────

  const inputClass =
    "w-full rounded-[10px] border border-[var(--border-warm)] bg-white px-4 py-3.5 text-base text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20 focus:outline-none";

  const primaryBtn =
    "w-full rounded-lg bg-[var(--maroon)] py-3.5 text-base font-medium text-[var(--ivory)] transition-colors hover:bg-[var(--maroon-deep)] disabled:opacity-50 active:bg-[var(--maroon-deep)]";

  const secondaryBtn =
    "w-full rounded-lg border border-[var(--border-warm)] bg-white py-3 text-sm font-medium text-[var(--gold-deep)] transition-colors hover:bg-[var(--cream-panel)] active:bg-[var(--cream-panel)]";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-[var(--cream)]">
      <div className="mx-auto w-full max-w-sm flex-1 px-4 pb-8 pt-4">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between">
          {step !== "code" && !emailConfirmNeeded ? (
            <button
              onClick={() => {
                if (step === "name") setStep("code");
                else if (step === "parent") setStep("name");
                else if (step === "confirm_self") setStep("parent");
                else if (step === "account") {
                  if (selfMatches.length > 0 && selectedParent) setStep("confirm_self");
                  else if (selectedParent || !selectedParent) setStep("parent");
                }
                setError("");
              }}
              className="text-sm font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]"
            >
              ← {t("reg_back", lang)}
            </button>
          ) : (
            <div />
          )}
          <LanguageToggle variant="page" />
        </div>

        {/* Crest */}
        <div className="mb-3 flex justify-center">
          <Crest size={64} />
        </div>

        {/* Title */}
        <h1 className="mb-1 text-center font-display text-xl font-semibold text-[var(--maroon)]">
          {t("reg_title", lang)}
        </h1>

        <StepDots current={stepIndex} total={4} />

        {/* ── STEP: CODE ─────────────────────────────────────────────── */}
        {step === "code" && (
          <div className="rounded-xl border border-[var(--border-card)] bg-white p-6 shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
            <h2 className="mb-1 text-lg font-semibold text-[var(--maroon-deep)]">
              {t("reg_step_code_title", lang)}
            </h2>
            <p className="mb-5 text-sm text-[var(--muted)]">
              {t("reg_step_code_hint", lang)}
            </p>
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
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
            )}

            <button
              onClick={handleCodeSubmit}
              disabled={!code.trim() || codeLoading}
              className={`mt-5 ${primaryBtn}`}
            >
              {codeLoading ? t("reg_checking", lang) : t("reg_next", lang)}
            </button>
          </div>
        )}

        {/* ── STEP: NAME ─────────────────────────────────────────────── */}
        {step === "name" && (
          <div className="rounded-xl border border-[var(--border-card)] bg-white p-6 shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
            <h2 className="mb-5 text-lg font-semibold text-[var(--maroon-deep)]">
              {t("reg_step_name_title", lang)}
            </h2>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("reg_name_placeholder", lang)}
              className={inputClass}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && fullName.trim() && handleNameNext()}
            />
            <button
              onClick={handleNameNext}
              disabled={!fullName.trim()}
              className={`mt-5 ${primaryBtn}`}
            >
              {t("reg_next", lang)}
            </button>
          </div>
        )}

        {/* ── STEP: PARENT ───────────────────────────────────────────── */}
        {step === "parent" && (
          <div className="rounded-xl border border-[var(--border-card)] bg-white p-6 shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
            <h2 className="mb-1 text-lg font-semibold text-[var(--maroon-deep)]">
              {t("reg_step_parent_title", lang)}
            </h2>
            <p className="mb-5 text-sm text-[var(--muted)]">
              {t("reg_step_parent_hint", lang)}
            </p>
            <input
              type="text"
              value={parentQuery}
              onChange={(e) => { setParentQuery(e.target.value); setParentSearchDone(false); }}
              placeholder={t("reg_parent_placeholder", lang)}
              className={inputClass}
              autoFocus
            />

            {/* Results */}
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {parentSearching && (
                <p className="py-3 text-center text-sm text-[var(--muted)]">
                  {t("reg_checking", lang)}
                </p>
              )}
              {!parentSearching && parentSearchDone && parentResults.length === 0 && parentQuery.trim().length >= 2 && (
                <p className="py-3 text-center text-sm text-[var(--muted)]">
                  {t("reg_parent_no_results", lang)}
                </p>
              )}
              {parentResults.map((p) => {
                const pName = bi(p.full_name, p.full_name_en, lang);
                const pCity = bi(p.city, p.city_en, lang);
                return (
                  <button
                    key={p.member_id}
                    onClick={() => handleParentSelect(p)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-card)] bg-[var(--cream)] p-3.5 text-left transition-colors hover:bg-[var(--border-warm)] active:bg-[var(--border-warm)]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ivory)] text-base font-bold text-[var(--maroon)]">
                      {pName?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-[var(--maroon-deep)]">{pName}</p>
                      {pCity && (
                        <p className="text-sm text-[var(--gold-deep)]">{pCity}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Skip */}
            <button onClick={handleSkipParent} className={`mt-5 ${secondaryBtn}`}>
              {t("reg_parent_skip", lang)}
            </button>
          </div>
        )}

        {/* ── STEP: CONFIRM SELF ─────────────────────────────────────── */}
        {step === "confirm_self" && (
          <div className="rounded-xl border border-[var(--border-card)] bg-white p-6 shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
            <h2 className="mb-1 text-lg font-semibold text-[var(--maroon-deep)]">
              {t("reg_is_this_you", lang)}
            </h2>
            <p className="mb-5 text-sm text-[var(--muted)]">
              {t("reg_is_this_you_hint", lang)}
            </p>

            <div className="space-y-2">
              {selfMatches.map((m) => {
                const mName = bi(m.full_name, m.full_name_en, lang);
                const mCity = bi(m.city, m.city_en, lang);

                if (m.already_claimed) {
                  // This member already has a login — don't allow claiming
                  return (
                    <div
                      key={m.member_id}
                      className="rounded-xl border border-[var(--border-card)] bg-[var(--cream-panel)] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ivory)] text-lg font-bold text-[var(--maroon)]">
                          {mName?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-semibold text-[var(--maroon-deep)]">{mName}</p>
                          {mCity && <p className="text-sm text-[var(--gold-deep)]">{mCity}</p>}
                        </div>
                      </div>
                      <div className="mt-3 rounded-lg bg-[var(--cream)] p-3">
                        <p className="text-sm font-medium text-[var(--maroon)]">
                          {t("reg_already_claimed", lang)}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {t("reg_already_claimed_hint", lang)}
                        </p>
                        <div className="mt-2 flex gap-3">
                          <Link
                            href="/login"
                            className="text-sm font-medium text-[var(--maroon)] underline underline-offset-2 hover:text-[var(--gold-deep)]"
                          >
                            {t("reg_go_to_login", lang)}
                          </Link>
                          <Link
                            href="/reset-password"
                            className="text-sm font-medium text-[var(--gold-deep)] underline underline-offset-2 hover:text-[var(--maroon)]"
                          >
                            {t("reg_forgot_password", lang)}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Claimable — let user tap to claim
                return (
                  <button
                    key={m.member_id}
                    onClick={() => handleClaimSelf(m.member_id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-card)] bg-[var(--cream)] p-4 text-left transition-colors hover:bg-[var(--border-warm)] active:bg-[var(--border-warm)]"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ivory)] text-lg font-bold text-[var(--maroon)]">
                      {mName?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-semibold text-[var(--maroon-deep)]">{mName}</p>
                      {mCity && <p className="text-sm text-[var(--gold-deep)]">{mCity}</p>}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[var(--gold-deep)]">
                      {t("reg_yes_thats_me", lang)} →
                    </span>
                  </button>
                );
              })}
            </div>

            <button onClick={handleNewSelf} className={`mt-5 ${secondaryBtn}`}>
              {t("reg_no_im_new", lang)}
            </button>
          </div>
        )}

        {/* ── STEP: ACCOUNT ──────────────────────────────────────────── */}
        {step === "account" && !emailConfirmNeeded && (
          <form onSubmit={handleCreateAccount} className="rounded-xl border border-[var(--border-card)] bg-white p-6 shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
            <h2 className="mb-5 text-lg font-semibold text-[var(--maroon-deep)]">
              {t("reg_step_account_title", lang)}
            </h2>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[var(--gold-deep)]">
                {t("email", lang)}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                className={inputClass}
                placeholder="email@example.com"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[var(--gold-deep)]">
                {t("password", lang)}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            <div className="mb-5">
              <label className="mb-1 block text-sm font-medium text-[var(--gold-deep)]">
                {t("reg_confirm_password", lang)}
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
            )}

            <button type="submit" disabled={creating} className={primaryBtn}>
              {creating ? t("reg_creating", lang) : t("reg_create_account", lang)}
            </button>
          </form>
        )}

        {/* ── EMAIL CONFIRMATION MESSAGE ──────────────────────────────── */}
        {emailConfirmNeeded && (
          <div className="rounded-xl border border-[var(--border-card)] bg-white p-6 text-center shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
            <div className="mx-auto mb-4 flex justify-center">
              <Crest size={56} />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--maroon-deep)]">
              {t("reg_email_confirm", lang)}
            </h2>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-lg bg-[var(--maroon)] px-6 py-3 font-medium text-[var(--ivory)] transition-colors hover:bg-[var(--maroon-deep)]"
            >
              {t("login_button", lang)}
            </Link>
          </div>
        )}

        {/* Bottom link */}
        {!emailConfirmNeeded && (
          <p className="mt-6 text-center text-sm text-[var(--gold-deep)]">
            <Link
              href="/login"
              className="font-medium underline underline-offset-2 hover:text-[var(--maroon)]"
            >
              {t("reg_have_account", lang)}
            </Link>
          </p>
        )}
      </div>

      <MakerMark />
    </div>
  );
}
