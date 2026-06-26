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

  // Detect if we arrived via a recovery link (Supabase sets a session with type=recovery)
  const [mode, setMode] = useState<"request" | "set">("request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event that fires when user clicks the reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("set");
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError(t("reg_password_short", lang));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("reg_password_mismatch", lang));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      console.error("Password reset failed:", error);
      setError(t("reset_error", lang));
    } else {
      setSuccess(true);
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

          {/* MODE: Request reset link */}
          {mode === "request" && !sent && (
            <form
              onSubmit={handleSendReset}
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

          {/* MODE: Reset link sent */}
          {mode === "request" && sent && (
            <div className="rounded-xl border border-[var(--border-card)] bg-white p-6 text-center shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl">
                ✉️
              </div>
              <p className="text-sm leading-relaxed text-[var(--maroon-deep)]">
                {t("reset_sent", lang)}
              </p>
              <Link
                href="/login"
                className="mt-5 inline-block rounded-lg bg-[var(--maroon)] px-6 py-3 font-medium text-[var(--ivory)] transition-colors hover:bg-[var(--maroon-deep)]"
              >
                {t("login_button", lang)}
              </Link>
            </div>
          )}

          {/* MODE: Set new password (arrived via recovery link) */}
          {mode === "set" && !success && (
            <form
              onSubmit={handleSetPassword}
              className="rounded-xl border border-[var(--border-card)] bg-white p-6 shadow-[0_1px_3px_rgba(110,30,42,0.06)]"
            >
              <p className="mb-5 text-sm text-[var(--muted)]">
                {t("reset_new_password", lang)}
              </p>
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
                  autoFocus
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
                {loading ? t("reset_setting", lang) : t("reset_set", lang)}
              </button>
            </form>
          )}

          {/* MODE: Success */}
          {mode === "set" && success && (
            <div className="rounded-xl border border-[var(--border-card)] bg-white p-6 text-center shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl">
                ✓
              </div>
              <p className="text-sm leading-relaxed text-[var(--maroon-deep)]">
                {t("reset_success", lang)}
              </p>
              <Link
                href="/login"
                className="mt-5 inline-block rounded-lg bg-[var(--maroon)] px-6 py-3 font-medium text-[var(--ivory)] transition-colors hover:bg-[var(--maroon-deep)]"
              >
                {t("login_button", lang)}
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
