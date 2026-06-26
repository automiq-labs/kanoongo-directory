"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import LanguageToggle from "@/app/language-toggle";
import { Crest } from "@/components/Crest";
import { MakerMark } from "@/components/MakerMark";

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
    <div className="flex min-h-screen flex-col bg-[var(--cream)]">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-4 flex justify-end">
            <LanguageToggle variant="page" />
          </div>

          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <Crest size={80} />
            </div>
            <h1 className="font-display text-2xl font-semibold text-[var(--maroon)]">
              {t("app_title", lang)}
            </h1>
            <p className="mt-2 text-[var(--gold-deep)]">{t("login_subtitle", lang)}</p>
          </div>

          <form
            onSubmit={handleLogin}
            className="rounded-xl border border-[var(--border-card)] bg-white p-6 shadow-[0_1px_3px_rgba(110,30,42,0.06)]"
          >
            <div className="mb-4">
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-[var(--gold-deep)]"
              >
                {t("email", lang)}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[10px] border border-[var(--border-warm)] px-3 py-3 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20 focus:outline-none"
                placeholder="email@example.com"
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-[var(--gold-deep)]"
              >
                {t("password", lang)}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[10px] border border-[var(--border-warm)] px-3 py-3 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--maroon)] py-2.5 font-medium text-[var(--ivory)] transition-colors hover:bg-[var(--maroon-deep)] disabled:opacity-50"
            >
              {loading ? t("login_loading", lang) : t("login_button", lang)}
            </button>
          </form>

          <div className="mt-5 flex flex-col items-center gap-2 text-sm">
            <Link href="/reset-password" className="font-medium text-[var(--gold-deep)] underline underline-offset-2 hover:text-[var(--maroon)]">
              {t("forgot_password", lang)}
            </Link>
            <Link href="/register" className="font-medium text-[var(--gold-deep)] underline underline-offset-2 hover:text-[var(--maroon)]">
              {t("reg_new_here", lang)}
            </Link>
          </div>
        </div>
      </div>

      <MakerMark />
    </div>
  );
}
