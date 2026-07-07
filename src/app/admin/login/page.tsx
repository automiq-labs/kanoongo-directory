"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import LanguageToggle from "@/app/language-toggle";
import { Crest } from "@/components/Crest";

export default function AdminLoginPage() {
  const { lang } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("error") === "not_admin"
      ? "" // will be set after hydration via searchParams
      : "";
  });

  // Show error from query param (server redirect for non-admin)
  const queryError = searchParams.get("error") === "not_admin"
    ? t("adm_login_not_admin", lang)
    : null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(t("login_error", lang));
      setLoading(false);
      return;
    }

    // Check admin status
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      await supabase.auth.signOut();
      setError(t("adm_login_not_admin", lang));
      setLoading(false);
      return;
    }

    router.replace("/admin");
  }

  const displayError = error || queryError;

  return (
    <div className="flex min-h-screen bg-[var(--paper)]">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .fade-up   { animation: fadeUp var(--dur) var(--ease-out) both; }
          .fade-up-d { animation: fadeUp var(--dur) var(--ease-out) .12s both; }
        }
      `}</style>

      {/* ── LEFT PANEL — desktop only ─────────────────────────────── */}
      <div
        className="hidden md:flex md:w-[45%] md:flex-col md:items-center md:justify-center md:px-10"
        style={{ background: "linear-gradient(180deg, var(--ink), #1a0a0e)" }}
      >
        <div className="fade-up relative mb-6 flex items-center justify-center">
          <div
            className="absolute h-[130px] w-[130px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(110,30,42,0.15) 0%, transparent 70%)" }}
          />
          <Crest size={100} />
        </div>
        <h1 className="fade-up-d font-display text-3xl font-semibold text-[#F4E3C1] text-center">
          {t("adm_login_title", lang)}
        </h1>
        <p className="fade-up-d mt-2 text-sm text-[#F4E3C1]/40">
          {t("adm_login_subtitle", lang)}
        </p>
        {/* Distinct admin badge */}
        <div className="fade-up-d mt-6 rounded-[var(--r-pill)] border border-[var(--maroon)]/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--maroon)]" style={{ background: "rgba(110,30,42,0.12)" }}>
          {lang === "en" ? "ADMINISTRATOR ACCESS" : "प्रशासक पहुँच"}
        </div>
      </div>

      {/* ── RIGHT PANEL / MOBILE COLUMN ───────────────────────────── */}
      <div
        className="flex flex-1 flex-col"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex justify-end px-5 py-2 md:px-8">
          <LanguageToggle variant="page" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-4 md:px-8">
          <div className="w-full max-w-[380px]">
            {/* ── MOBILE HEADER (hidden md+) ────────────────────── */}
            <div className="fade-up mb-8 text-center md:hidden">
              <div className="relative mx-auto mb-4 flex w-fit items-center justify-center">
                <div
                  className="absolute h-[100px] w-[100px] rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(110,30,42,0.10) 0%, transparent 70%)" }}
                />
                <Crest size={72} />
              </div>
              <h1 className="font-display text-2xl font-semibold text-[var(--maroon)]">
                {t("adm_login_title", lang)}
              </h1>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                {t("adm_login_subtitle", lang)}
              </p>
              <div className="mx-auto mt-3 w-fit rounded-[var(--r-pill)] border border-[var(--maroon)]/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--maroon)]" style={{ background: "rgba(110,30,42,0.06)" }}>
                {lang === "en" ? "ADMINISTRATOR" : "प्रशासक"}
              </div>
            </div>

            {/* ── FORM CARD ──────────────────────────────────────── */}
            <form
              onSubmit={handleLogin}
              className="fade-up-d rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-6 shadow-card"
            >
              <div className="mb-5">
                <label htmlFor="adm-email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {t("email", lang)}
                </label>
                <input
                  id="adm-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-4 py-3 text-base text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                  placeholder="admin@example.com"
                />
              </div>

              <div className="mb-6">
                <label htmlFor="adm-password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {t("password", lang)}
                </label>
                <input
                  id="adm-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-4 py-3 text-base text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              {displayError && (
                <div
                  className="mb-4 rounded-[var(--r-sm)] px-4 py-3 text-sm font-medium text-[var(--maroon-deep)]"
                  style={{ background: "rgba(110,30,42,0.08)" }}
                >
                  {displayError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="min-h-[48px] w-full rounded-[var(--r)] bg-[var(--maroon)] font-medium text-[var(--ivory)] motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] active:scale-[.98] disabled:opacity-50"
              >
                {loading ? t("login_loading", lang) : t("login_button", lang)}
              </button>
            </form>

            {/* ── LINKS ──────────────────────────────────────────── */}
            <div className="mt-6 flex flex-col items-center gap-1">
              <Link
                href="/reset-password"
                className="flex min-h-[44px] items-center text-sm font-medium text-[var(--maroon)] underline-offset-2 hover:underline hover:decoration-[var(--gold)]"
              >
                {t("forgot_password", lang)}
              </Link>
            </div>

            {/* ── FOOTER: member portal link ─────────────────────── */}
            <p className="mt-8 text-center">
              <Link
                href="/login"
                className="text-xs text-[var(--muted)] underline-offset-2 hover:underline hover:text-[var(--maroon)]"
              >
                ← {t("adm_login_member_portal", lang)}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
