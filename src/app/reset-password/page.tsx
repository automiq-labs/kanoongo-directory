"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { Crest } from "@/components/Crest";
import { MakerMark } from "@/components/MakerMark";
import LanguageToggle from "@/app/language-toggle";

export default function ResetPasswordPage() {
  const { lang } = useLang();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<"request" | "verify" | "success">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [legacyNotice, setLegacyNotice] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Detect legacy recovery links and clean URL
  useEffect(() => {
    const combined = window.location.hash + window.location.search;
    if (
      combined.includes("type=recovery") ||
      combined.includes("error_code=otp_expired") ||
      combined.includes("error=access_denied")
    ) {
      window.history.replaceState({}, "", window.location.pathname);
      setLegacyNotice(true);
    }
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

    if (error) {
      setError(error.message);
    } else {
      setStep("verify");
      setCooldown(30);
    }
    setLoading(false);
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

    if (error) {
      setError(error.message);
    } else {
      setCooldown(30);
    }
    setLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(code.trim())) {
      setError(t("reset_code_invalid", lang));
      return;
    }
    if (newPassword.length < 6) {
      setError(t("reg_password_short", lang));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("reg_password_mismatch", lang));
      return;
    }

    setLoading(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "recovery",
    });

    if (verifyError) {
      setError(t("reset_code_invalid", lang));
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(t("reset_error", lang));
    } else {
      setStep("success");
    }
    setLoading(false);
  }

  const inputClass =
    "w-full rounded-[10px] border border-[var(--border-warm)] bg-white px-4 py-3.5 text-base text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20 focus:outline-none";

  const primaryBtn =
    "w-full rounded-lg bg-[var(--maroon)] py-3.5 text-base font-medium text-[var(--ivory)] transition-colors hover:bg-[var(--maroon-deep)] disabled:opacity-50";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--cream)]">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-4 flex justify-end">
            <LanguageToggle variant="page" />
          </div>

          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <Crest size={64} />
            </div>
            <h1 className="font-display text-xl font-semibold text-[var(--maroon)]">
              {t("reset_title", lang)}
            </h1>
          </div>

          {/* Legacy link notice */}
          {legacyNotice && step === "request" && (
            <div className="mb-4 rounded-[var(--r-sm)] px-4 py-3 text-sm font-medium text-[var(--maroon-deep)]" style={{ background: "rgba(110,30,42,0.06)" }}>
              {t("reset_use_code", lang)}
            </div>
          )}

          {/* Step: Request code */}
          {step === "request" && (
            <form
              onSubmit={handleSendCode}
              className="rounded-xl border border-[var(--border-card)] bg-white p-6 shadow-[0_1px_3px_rgba(110,30,42,0.06)]"
            >
              <p className="mb-5 text-sm text-[var(--muted)]">
                {t("reset_enter_email", lang)}
              </p>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                className={inputClass}
                placeholder="email@example.com"
                autoFocus
              />
              {error && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
              )}
              <button type="submit" disabled={loading || !email.trim()} className={`mt-5 ${primaryBtn}`}>
                {loading ? t("reset_sending", lang) : t("reset_send", lang)}
              </button>
            </form>
          )}

          {/* Step: Verify code & set password */}
          {step === "verify" && (
            <form
              onSubmit={handleVerify}
              className="rounded-xl border border-[var(--border-card)] bg-white p-6 shadow-[0_1px_3px_rgba(110,30,42,0.06)]"
            >
              <p className="mb-5 text-sm text-[var(--muted)]">
                {t("reset_sent", lang)} <span className="font-medium text-[var(--maroon-deep)]">{email}</span>
              </p>
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-[var(--gold-deep)]">
                  {t("reset_code_label", lang)}
                </label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
                  className={`${inputClass} text-center tracking-[0.3em]`}
                  placeholder="000000"
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
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
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
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? t("reset_setting", lang) : t("reset_verify", lang)}
              </button>
              <p className="mt-4 text-center text-sm text-[var(--muted)]">
                {cooldown > 0 ? (
                  <span>{t("reset_resend_wait", lang)} {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="font-medium text-[var(--gold-deep)] underline underline-offset-2 hover:text-[var(--maroon)] disabled:opacity-50"
                  >
                    {t("reset_resend", lang)}
                  </button>
                )}
              </p>
            </form>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <div className="rounded-xl border border-[var(--border-card)] bg-white p-6 text-center shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl">
                ✓
              </div>
              <p className="text-sm leading-relaxed text-[var(--maroon-deep)]">
                {t("reset_success", lang)}
              </p>
              <Link
                href="/"
                className="mt-5 inline-block rounded-lg bg-[var(--maroon)] px-6 py-3 font-medium text-[var(--ivory)] transition-colors hover:bg-[var(--maroon-deep)]"
              >
                {t("reset_go_home", lang)}
              </Link>
            </div>
          )}

          <p className="mt-5 text-center text-sm text-[var(--gold-deep)]">
            <Link href="/login" className="font-medium underline underline-offset-2 hover:text-[var(--maroon)]">
              {t("reg_have_account", lang)}
            </Link>
          </p>
        </div>
      </div>

      <MakerMark />
    </div>
  );
}
