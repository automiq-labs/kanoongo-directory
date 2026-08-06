"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t, type Lang } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import { getCelebrations, type Celebration } from "@/lib/celebrations";
import LanguageToggle from "@/app/language-toggle";
import BottomNav from "@/app/bottom-nav";
import InitialsAvatar from "@/components/form/InitialsAvatar";
import { FadeIn } from "@/components/Motion";

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysLabel(n: number, lang: string): string {
  if (n === 0) return lang === "en" ? "Today" : "आज";
  if (n === 1) return lang === "en" ? "Tomorrow" : "कल";
  return lang === "en" ? `in ${n} days` : `${n} दिन में`;
}

/** S22: month names were a hardcoded English array, so the chips read "12 Mar"
 *  under the Hindi toggle. */
function formatDateChip(isoDate: string, lang: Lang): string {
  const d = new Date(isoDate + "T00:00:00");
  return `${d.getDate()} ${t("month_short", lang).split(" ")[d.getMonth()]}`;
}

interface Section {
  key: string;
  labelEn: string;
  labelHi: string;
  items: Celebration[];
}

function groupByTime(celebrations: Celebration[]): Section[] {
  const today: Celebration[] = [];
  const thisWeek: Celebration[] = [];
  const thisMonth: Celebration[] = [];
  const later: Celebration[] = [];

  for (const c of celebrations) {
    if (c.days_until === 0) today.push(c);
    else if (c.days_until <= 7) thisWeek.push(c);
    else if (c.days_until <= 31) thisMonth.push(c);
    else later.push(c);
  }

  const sections: Section[] = [];
  if (today.length) sections.push({ key: "today", labelEn: "Today", labelHi: "आज", items: today });
  if (thisWeek.length) sections.push({ key: "week", labelEn: "This Week", labelHi: "इस सप्ताह", items: thisWeek });
  if (thisMonth.length) sections.push({ key: "month", labelEn: "This Month", labelHi: "इस माह", items: thisMonth });
  if (later.length) sections.push({ key: "later", labelEn: "Later", labelHi: "आगामी", items: later });
  return sections;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CelebrationsPage() {
  const { lang } = useLang();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await getCelebrations(supabase, 90);
      if (!cancelled) {
        setCelebrations(data);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  const sections = groupByTime(celebrations);

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-24 md:ml-[240px] md:pb-8">
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b border-[var(--hairline)] px-5 pb-3 shadow-[var(--shadow-header)]"
        style={{
          background: "linear-gradient(180deg, #33121a, var(--ink))",
          paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
        }}
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
            🎉 {t("celebrations_title", lang)}
          </h1>
          <LanguageToggle />
        </div>
      </header>

      <div className="mx-auto max-w-lg md:max-w-2xl px-5 pt-4">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--cream-panel)]" />
                <div className="flex-1">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--cream-panel)]" />
                  <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-[var(--cream-panel)]" />
                </div>
                <div className="h-5 w-12 animate-pulse rounded bg-[var(--cream-panel)]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && celebrations.length === 0 && (
          <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-8 text-center shadow-card">
            <p className="text-3xl">🎂</p>
            <p className="mt-3 font-display text-base font-semibold text-[var(--maroon-deep)]">
              {lang === "en"
                ? "No upcoming celebrations in the next three months."
                : "अगले तीन महीनों में कोई उत्सव नहीं है।"}
            </p>
          </div>
        )}

        {/* Sections */}
        {!loading && sections.map((section) => (
          <div key={section.key} className="mb-6">
            {/* Section eyebrow */}
            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {lang === "en" ? section.labelEn : section.labelHi}
            </h2>

            <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] shadow-card">
              {section.items.map((c, i) => {
                const name = bi(c.full_name, c.full_name_en, lang);
                const partnerName = bi(c.partner_name, c.partner_name_en, lang);

                return (
                  <FadeIn key={`${c.link_member_id}-${c.kind}-${i}`} delay={Math.min(i * 0.03, 0.15)}>
                    <Link
                      href={`/family/${c.link_member_id}`}
                      className={`flex items-center gap-3 px-3.5 py-3 motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)] ${
                        i > 0 ? "border-t border-[var(--hairline)]" : ""
                      }`}
                    >
                      <InitialsAvatar
                        name={c.full_name}
                        nameEn={c.full_name_en}
                        photoUrl={c.photo_url}
                        size="sm"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-semibold text-[var(--maroon-deep)]">
                          {name}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] leading-snug text-[var(--muted)]">
                          {c.kind === "birthday" ? (
                            <>
                              🎂 {lang === "en" ? "Birthday" : "जन्मदिन"} · {daysLabel(c.days_until, lang)}
                              {c.years != null && c.years > 0
                                ? ` · ${lang === "en" ? `turning ${c.years}` : `${c.years} वर्ष`}`
                                : ""}
                            </>
                          ) : (
                            <>
                              💐 {lang === "en" ? "Anniversary" : "सालगिरह"} · {daysLabel(c.days_until, lang)}
                              {partnerName ? ` · ${partnerName}` : ""}
                              {c.years != null && c.years > 0
                                ? ` · ${c.years} ${lang === "en" ? "yrs" : "वर्ष"}`
                                : ""}
                            </>
                          )}
                        </p>
                      </div>

                      {/* Date chip */}
                      <span className="shrink-0 rounded-[var(--r-sm)] bg-[var(--cream-panel)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                        {formatDateChip(c.next_date, lang)}
                      </span>
                    </Link>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
