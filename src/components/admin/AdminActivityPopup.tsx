"use client";

import { useState, useEffect, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { bi } from "@/lib/bilingual";

interface ActivityRow {
  id: string;
  at: string;
  action: string;
  actor: string;
  actor_member_name: string | null;
  actor_member_name_en: string | null;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  target_name_en: string | null;
  details: Record<string, unknown> | null;
}

interface GroupedLogin {
  actor: string;
  name: string | null;
  nameEn: string | null;
  count: number;
  latestAt: string;
  memberId: string | null;
}

function relativeTime(iso: string, lang: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return lang === "en" ? "just now" : "अभी";
  const min = Math.floor(sec / 60);
  if (min < 60) return lang === "en" ? `${min}m ago` : `${min} मि. पहले`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return lang === "en" ? `${hr}h ago` : `${hr} घं. पहले`;
  const d = Math.floor(hr / 24);
  return lang === "en" ? `${d}d ago` : `${d} दिन पहले`;
}

export default function AdminActivityPopup({
  action,
  supabase,
  memberIdByEmail,
  onClose,
  onOpenMember,
}: {
  action: "signup" | "login";
  supabase: SupabaseClient;
  memberIdByEmail: Record<string, string>;
  onClose: () => void;
  onOpenMember: (memberId: string) => void;
}) {
  const { lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [signupRows, setSignupRows] = useState<ActivityRow[]>([]);
  const [groupedLogins, setGroupedLogins] = useState<GroupedLogin[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_get_activity", {
      p_limit: 200,
      p_offset: 0,
      p_action: action,
    });
    if (!error && data) {
      const d = data as { total: number; rows: ActivityRow[] };
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent = d.rows.filter((r) => new Date(r.at).getTime() >= cutoff);

      if (action === "signup") {
        setSignupRows(recent);
      } else {
        // Group logins by actor
        const map = new Map<string, GroupedLogin>();
        for (const r of recent) {
          const key = r.actor;
          const existing = map.get(key);
          if (existing) {
            existing.count++;
            if (r.at > existing.latestAt) existing.latestAt = r.at;
            if (!existing.name && r.actor_member_name) existing.name = r.actor_member_name;
            if (!existing.nameEn && r.actor_member_name_en) existing.nameEn = r.actor_member_name_en;
          } else {
            map.set(key, {
              actor: r.actor,
              name: r.actor_member_name,
              nameEn: r.actor_member_name_en,
              count: 1,
              latestAt: r.at,
              memberId: memberIdByEmail[r.actor] || null,
            });
          }
        }
        setGroupedLogins(
          Array.from(map.values()).sort((a, b) => (b.latestAt > a.latestAt ? 1 : -1)),
        );
      }
    }
    setLoading(false);
  }, [supabase, action, memberIdByEmail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching effect, setState in async callback
    load();
  }, [load]);

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

  const title = action === "signup"
    ? t("adm_popup_signups_7d", lang)
    : t("adm_popup_logins_7d", lang);

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
          <h2 className="font-display text-base font-semibold text-[var(--maroon)]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--cream-panel)] hover:text-[var(--maroon)]"
            aria-label={t("close", lang)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--cream-panel)]" />
                  <div className="flex-1">
                    <div className="h-4 w-32 animate-pulse rounded bg-[var(--cream-panel)]" />
                    <div className="mt-1 h-3 w-48 animate-pulse rounded bg-[var(--cream-panel)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : action === "signup" ? (
            signupRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">{t("adm_popup_empty", lang)}</p>
            ) : (
              <div className="space-y-2">
                {signupRows.map((row) => {
                  const name = bi(row.actor_member_name, row.actor_member_name_en, lang);
                  const mid = memberIdByEmail[row.actor];
                  const Tag = mid ? "button" : "div";
                  return (
                    <Tag
                      key={row.id}
                      {...(mid ? { onClick: () => { onOpenMember(mid); onClose(); } } : {})}
                      className={`flex w-full items-center gap-3 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-3 text-left shadow-card ${mid ? "cursor-pointer hover:shadow-lift motion-safe:transition-shadow motion-safe:duration-[var(--dur)]" : ""}`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--cream-panel)] font-display text-xs font-bold text-[var(--maroon)]">
                        {(name || row.actor).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--maroon-deep)]">{name || row.actor}</p>
                        <p className="truncate text-xs text-[var(--muted)]">{row.actor}</p>
                      </div>
                      <p className="shrink-0 text-[11px] text-[var(--muted)]">{relativeTime(row.at, lang)}</p>
                    </Tag>
                  );
                })}
              </div>
            )
          ) : (
            groupedLogins.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">{t("adm_popup_empty", lang)}</p>
            ) : (
              <div className="space-y-2">
                {groupedLogins.map((g) => {
                  const name = bi(g.name, g.nameEn, lang);
                  const Tag = g.memberId ? "button" : "div";
                  return (
                    <Tag
                      key={g.actor}
                      {...(g.memberId ? { onClick: () => { onOpenMember(g.memberId!); onClose(); } } : {})}
                      className={`flex w-full items-center gap-3 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-3 text-left shadow-card ${g.memberId ? "cursor-pointer hover:shadow-lift motion-safe:transition-shadow motion-safe:duration-[var(--dur)]" : ""}`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--cream-panel)] font-display text-xs font-bold text-[var(--maroon)]">
                        {(name || g.actor).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--maroon-deep)]">{name || g.actor}</p>
                        <p className="truncate text-xs text-[var(--muted)]">{g.actor}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {g.count > 1 && (
                          <p className="text-[11px] font-semibold text-[var(--gold-deep)]">
                            &times;{g.count} {t("adm_popup_times", lang)}
                          </p>
                        )}
                        <p className="text-[11px] text-[var(--muted)]">{relativeTime(g.latestAt, lang)}</p>
                      </div>
                    </Tag>
                  );
                })}
              </div>
            )
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
