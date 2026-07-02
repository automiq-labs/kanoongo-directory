"use client";

import Link from "next/link";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import type { OnboardingState } from "@/lib/onboarding";

export default function WelcomeCard({ state }: { state: OnboardingState }) {
  const { lang } = useLang();

  const name = lang === "en" ? (state.full_name_en || state.full_name) : (state.full_name || state.full_name_en);
  const greeting = name
    ? lang === "en" ? `Welcome, ${name} 🙏` : `नमस्ते ${name} 🙏`
    : lang === "en" ? "Welcome 🙏" : "नमस्ते 🙏";

  return (
    <div className="mb-4 rounded-[var(--r)] border border-[#ECE0C8] bg-[var(--raised)] px-4 py-3 shadow-card">
      <p className="font-display text-[17px] font-semibold text-[var(--maroon-deep)]">
        {greeting}
      </p>
      <p className="mt-0.5 text-[13px] text-[var(--muted)]">
        {t("onb_welcome_sub", lang)}
      </p>
      {!state.profile_complete && state.member_id && (
        <Link
          href={`/family/${state.member_id}`}
          className="mt-2.5 inline-flex min-h-[36px] items-center rounded-[var(--r-sm)] bg-[var(--maroon)] px-4 py-1.5 text-[13px] font-medium text-[var(--ivory)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)]"
        >
          {t("onb_complete_profile", lang)}
        </Link>
      )}
    </div>
  );
}
