"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import type { OnboardingState } from "@/lib/onboarding";

const STEP_ICONS = [
  // 0: Intro — heart
  "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  // 1: Directory — users (same as nav)
  "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  // 2: Celebrations — sparkles (same as nav)
  "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  // 3: Notices — bell (same as nav)
  "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  // 4: Family Tree — tree boxes (same as nav)
  "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM9 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
  // 5: My Family — home (same as nav)
  "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
];

const STEP_KEYS = [
  { title: "onb_step1_title", body: "onb_step1_body" },
  { title: "onb_step2_title", body: "onb_step2_body" },
  { title: "onb_step3_title", body: "onb_step3_body" },
  { title: "onb_step4_title", body: "onb_step4_body" },
  { title: "onb_step5_title", body: "onb_step5_body" },
  { title: "onb_step6_title", body: "onb_step6_body" },
] as const;

export default function OnboardingTour({
  state,
  onClose,
}: {
  state: OnboardingState;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(0);

  // Record view exactly once when the tour opens
  useEffect(() => {
    supabase.rpc("record_onboarding_view");
  }, [supabase]);

  // Dismiss on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isLast = step === STEP_KEYS.length - 1;
  const { title, body } = STEP_KEYS[step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center motion-safe:animate-[fadeIn_200ms_ease-out]"
      style={{ background: "rgba(30,8,12,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl sm:mx-4 bg-[var(--raised)] px-5 pt-5 shadow-xl motion-safe:animate-[slideUp_250ms_ease-out] sm:animate-none"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Later button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-[13px] font-medium text-[var(--muted)] hover:text-[var(--maroon)]"
          >
            {t("onb_later", lang)}
          </button>
        </div>

        {/* Icon */}
        <div className="mt-1 flex justify-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(201,150,46,0.12)" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-[var(--gold-deep)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={STEP_ICONS[step]} />
            </svg>
          </div>
        </div>

        {/* Content */}
        <h2 className="mt-3 text-center font-display text-lg font-semibold text-[var(--maroon)]">
          {t(title, lang)}
        </h2>
        <p className="mt-1.5 text-center text-sm leading-relaxed text-[var(--muted)]">
          {t(body, lang)}
        </p>

        {/* Last step CTA */}
        {isLast && state.member_id && (
          <Link
            href={`/family/${state.member_id}`}
            onClick={onClose}
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-[var(--maroon)] py-3 text-base font-medium text-[var(--ivory)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)]"
          >
            {t("onb_complete_profile", lang)}
          </Link>
        )}

        {/* Dots */}
        <div className="mt-4 flex justify-center gap-1.5">
          {STEP_KEYS.map((_, i) => (
            <div
              key={i}
              className={`h-[6px] w-[6px] rounded-full motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                i === step ? "bg-[var(--maroon)]" : "bg-[var(--gold)]/40"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-4 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="min-h-[44px] px-3 text-sm font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]"
            >
              {t("onb_back", lang)}
            </button>
          ) : (
            <div />
          )}
          {isLast ? (
            <button
              onClick={onClose}
              className="min-h-[44px] px-3 text-sm font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]"
            >
              {t("onb_done", lang)}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="min-h-[44px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-5 text-sm font-medium text-[var(--ivory)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)]"
            >
              {t("onb_next", lang)}
            </button>
          )}
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .motion-safe\\:animate-\\[fadeIn_200ms_ease-out\\],
          .motion-safe\\:animate-\\[slideUp_250ms_ease-out\\] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
