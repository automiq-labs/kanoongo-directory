"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import LanguageToggle from "@/app/language-toggle";
import { Crest } from "@/components/Crest";
import { MakerMark } from "@/components/MakerMark";
import { FooterCredits } from "@/components/FooterCredits";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { lang } = useLang();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(t("login_error", lang));
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-[var(--paper)]">
      {/* Entrance animation */}
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
        style={{ background: "linear-gradient(180deg, #33121a, var(--ink))" }}
      >
        <div className="fade-up relative mb-6 flex items-center justify-center">
          <div
            className="absolute h-[130px] w-[130px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(201,150,46,0.12) 0%, transparent 70%)" }}
          />
          <Crest size={100} />
        </div>
        <h1 className="fade-up-d font-display text-3xl font-semibold text-[#F4E3C1] text-center">
          {t("app_title", lang)}
        </h1>
        <p className="fade-up-d mt-2 text-sm" style={{ color: "rgba(201,150,46,0.55)" }}>
          {t("login_subtitle", lang)}
        </p>
        {/* Archival family photo — mat-framed */}
        <div className="fade-up-d mt-8 w-full max-w-[380px]">
          <div className="rounded-md border border-[var(--gold)]/50 bg-[#F4E3C1]/10 p-[6px] shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
            <div className="overflow-hidden rounded-sm" style={{ filter: "sepia(0.2) saturate(0.85)" }}>
              <Image src="/login-family-photo.jpg" alt={t("login_photo_caption", lang)} width={1108} height={856} className="w-full" priority />
            </div>
          </div>
          <p className="mt-2.5 text-center text-[11px] italic" style={{ color: "rgba(201,150,46,0.45)" }}>
            {t("login_photo_caption", lang)}
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL / MOBILE COLUMN ───────────────────────────── */}
      <div
        className="flex flex-1 flex-col"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}
      >
        {/* Language toggle — top right */}
        <div className="flex justify-end px-5 py-2 md:px-8">
          <LanguageToggle variant="page" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-4 md:px-8">
          <div className="w-full max-w-[380px]">
            {/* ── MOBILE CREST HERO (hidden md+) ─────────────────── */}
            <div className="fade-up mb-8 text-center md:hidden">
              <div className="relative mx-auto mb-4 flex w-fit items-center justify-center">
                <div
                  className="absolute h-[100px] w-[100px] rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(201,150,46,0.10) 0%, transparent 70%)" }}
                />
                <Crest size={72} />
              </div>
              <h1 className="font-display text-2xl font-semibold text-[var(--maroon)]">
                {t("app_title", lang)}
              </h1>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                {t("login_subtitle", lang)}
              </p>
              {/* Archival photo — compact, visible on all phones */}
              <div className="mx-auto mt-4 w-[75%] max-w-[260px] md:hidden">
                <div className="rounded border border-[var(--gold)]/40 bg-[#F4E3C1]/10 p-[4px] shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
                  <div className="overflow-hidden rounded-sm" style={{ filter: "sepia(0.2) saturate(0.85)", maxHeight: "150px" }}>
                    <Image src="/login-family-photo.jpg" alt={t("login_photo_caption", lang)} width={1108} height={856} className="w-full object-cover object-top" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── FORM CARD ──────────────────────────────────────── */}
            <form
              onSubmit={handleLogin}
              className="fade-up-d rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-6 shadow-card"
            >
              {/* Email */}
              <div className="mb-5">
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]"
                >
                  {t("email", lang)}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-4 py-3 text-base text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                  placeholder="email@example.com"
                />
              </div>

              {/* Password */}
              <div className="mb-6">
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]"
                >
                  {t("password", lang)}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-4 py-3 text-base text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              {/* Error */}
              {error && (
                <div
                  className="mb-4 rounded-[var(--r-sm)] px-4 py-3 text-sm font-medium text-[var(--maroon-deep)]"
                  style={{ background: "rgba(110,30,42,0.06)" }}
                >
                  {error}
                </div>
              )}

              {/* Submit */}
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
              <Link
                href="/register"
                className="flex min-h-[44px] items-center text-sm font-medium text-[var(--maroon)] underline-offset-2 hover:underline hover:decoration-[var(--gold)]"
              >
                {t("reg_new_here", lang)}
              </Link>
            </div>
          </div>
        </div>

        {/* Attribution + support */}
        <FooterCredits className="px-5 pb-3" />

        {/* Maker mark */}
        <MakerMark />
      </div>
    </div>
  );
}
