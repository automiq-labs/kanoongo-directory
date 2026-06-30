"use client";

import { useRouter } from "next/navigation";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { Crest } from "@/components/Crest";
import LanguageToggle from "@/app/language-toggle";

export default function AboutPage() {
  const { lang } = useLang();
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--cream)] md:ml-[240px]">
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b border-[var(--hairline)] px-5 pb-3 shadow-[var(--shadow-header)]"
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
            {t("about_title", lang)}
          </h1>
          <LanguageToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <Crest size={90} />

        <h2 className="mt-6 font-display text-2xl font-semibold text-[var(--maroon)]">
          {t("app_title", lang)}
        </h2>

        <p className="mt-3 leading-relaxed text-[var(--gold-deep)]">
          {t("about_desc", lang)}
        </p>

        <div className="mt-10 h-px w-16 bg-[var(--gold)]/30" />

        <p className="mt-6 text-sm tracking-wide text-[var(--muted)]">
          {t("about_crafted", lang)}
        </p>
        <a
          href="https://www.automiqlabs.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 font-display text-lg font-semibold text-[var(--maroon)] transition-colors hover:text-[var(--gold-deep)]"
        >
          Automiq Labs
        </a>
        <p className="mt-1 text-xs tracking-wider text-[var(--muted)]">
          automiqlabs.com
        </p>
      </div>
    </div>
  );
}
