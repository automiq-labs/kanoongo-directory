"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/language-context";
import { t, type TranslationKey } from "@/lib/translations";
import { bi } from "@/lib/bilingual";

export interface DaughterRow {
  md_id: string;
  d_member_id: string | null;
  full_name: string;
  full_name_en: string | null;
  city: string | null;
  city_en: string | null;
  mobile: string | null;
}

/**
 * Drill-down list behind the "Married Daughters" / "Claimed Married Daughters"
 * dashboard cards. Same sheet shape as AdminActivityPopup.
 */
export default function AdminDaughtersPopup({
  rows,
  titleKey,
  emptyKey,
  onClose,
  onOpenMember,
}: {
  rows: DaughterRow[];
  titleKey: TranslationKey;
  emptyKey: TranslationKey;
  onClose: () => void;
  onOpenMember: (memberId: string) => void;
}) {
  const { lang } = useLang();

  // Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center motion-safe:animate-[fadeIn_200ms_ease-out]"
      style={{ background: "rgba(30,8,12,0.55)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[var(--raised)] shadow-xl sm:rounded-2xl sm:mx-4 motion-safe:animate-[slideUp_250ms_ease-out] sm:animate-none"
        style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-3.5">
          <h2 className="font-display text-base font-semibold text-[var(--maroon)]">
            {t(titleKey, lang)}
            <span className="ml-2 text-sm font-normal text-[var(--muted)]">{rows.length}</span>
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--cream-panel)] hover:text-[var(--maroon)]"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">{t(emptyKey, lang)}</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const name = bi(row.full_name, row.full_name_en, lang);
                const city = bi(row.city, row.city_en, lang);
                const mid = row.d_member_id;
                const Tag = mid ? "button" : "div";
                return (
                  <Tag
                    key={row.md_id}
                    {...(mid ? { onClick: () => { onOpenMember(mid); onClose(); } } : {})}
                    className={`flex w-full items-center gap-3 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-3 text-left shadow-card ${mid ? "cursor-pointer hover:shadow-lift motion-safe:transition-shadow motion-safe:duration-[var(--dur)]" : ""}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--cream-panel)] font-display text-xs font-bold text-[var(--maroon)]">
                      {name?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--maroon-deep)]">{name || "—"}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                        {mid && <span>{mid}</span>}
                        {mid && city && (
                          <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--gold)] opacity-80" />
                        )}
                        {city && <span>{city}</span>}
                      </div>
                    </div>
                    {row.mobile && (
                      <span className="shrink-0 text-[11px] text-[var(--gold-deep)]">{row.mobile}</span>
                    )}
                  </Tag>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .motion-safe\\:animate-\\[fadeIn_200ms_ease-out\\],
          .motion-safe\\:animate-\\[slideUp_250ms_ease-out\\] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
