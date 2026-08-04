"use client";

import { useState, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useLang } from "@/lib/language-context";
import { t, type TranslationKey } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import { changedFieldLabels, extractChangedFields } from "@/lib/field-labels";

interface ActivityRow {
  id: string;
  at: string;
  action: string;
  actor: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  target_name_en: string | null;
  details: Record<string, unknown> | null;
}

const ACTION_ICONS: Record<string, string> = {
  signup:
    "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  login:
    "M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1",
  edit:
    "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  admin_edit:
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  admin_delete_cascade:
    "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  admin_unlink_claim:
    "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  admin_delete_auth_user:
    "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  admin_set_invite_code:
    "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
  admin_set_edit_blocked:
    "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
};

/** Longest field list shown inline before collapsing into "+N more". */
const MAX_FIELD_LABELS = 4;

const VERB_MAP: Record<string, TranslationKey> = {
  signup: "adm_verb_signup",
  login: "adm_verb_login",
  edit: "adm_verb_edit",
  admin_edit: "adm_verb_admin_edit",
  admin_delete_cascade: "adm_verb_admin_delete",
  admin_unlink_claim: "adm_verb_admin_unlink",
  admin_delete_auth_user: "adm_verb_admin_delete_auth",
  admin_set_invite_code: "adm_verb_admin_set_invite",
};

type FilterKey = "all" | "login" | "signup" | "edit" | "admin";

/**
 * admin_set_edit_blocked rows carry `{ blocked: true|false }` rather than a
 * field list, so the verb itself has to say what happened.
 */
function verbKeyFor(row: ActivityRow): TranslationKey {
  if (row.action === "admin_set_edit_blocked") {
    const blocked = row.details?.blocked;
    if (blocked === true) return "adm_verb_admin_block";
    if (blocked === false) return "adm_verb_admin_unblock";
    return "adm_verb_admin_edit_perm";
  }
  return VERB_MAP[row.action] || "adm_verb_edit";
}

function relativeTime(iso: string, lang: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return lang === "en" ? "just now" : "अभी";
  const min = Math.floor(sec / 60);
  if (min < 60) return lang === "en" ? `${min}m ago` : `${min} मि. पहले`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return lang === "en" ? `${hr}h ago` : `${hr} घं. पहले`;
  const d = Math.floor(hr / 24);
  if (d < 30) return lang === "en" ? `${d}d ago` : `${d} दिन पहले`;
  const mo = Math.floor(d / 30);
  return lang === "en" ? `${mo}mo ago` : `${mo} माह पहले`;
}

export default function AdminActivityFeed({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const { lang } = useLang();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [offset, setOffset] = useState(0);
  const PAGE = 50;

  const load = useCallback(
    async (f: FilterKey, off: number, append: boolean) => {
      setLoading(true);
      let actionParam: string | null = null;
      if (f === "login") actionParam = "login";
      else if (f === "signup") actionParam = "signup";
      else if (f === "edit") actionParam = "edit";
      // "admin" is client-filtered from "all"

      const { data, error } = await supabase.rpc("admin_get_activity", {
        p_limit: PAGE,
        p_offset: off,
        p_action: actionParam,
      });
      if (!error && data) {
        const d = data as { total: number; rows: ActivityRow[] };
        let filtered = d.rows;
        if (f === "admin") {
          filtered = filtered.filter((r) => r.action.startsWith("admin_"));
        }
        setTotal(f === "admin" ? filtered.length : d.total);
        setRows(append ? (prev) => [...prev, ...filtered] : filtered);
      }
      setLoading(false);
    },
    [supabase]
  );

  // Initial load
  const [didLoad, setDidLoad] = useState(false);
  if (!didLoad) {
    setDidLoad(true);
    load("all", 0, false);
  }

  function changeFilter(f: FilterKey) {
    setFilter(f);
    setOffset(0);
    load(f, 0, false);
  }

  function loadMore() {
    const next = offset + PAGE;
    setOffset(next);
    load(filter, next, true);
  }

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: t("adm_activity_all", lang) },
    { key: "login", label: t("adm_activity_logins", lang) },
    { key: "signup", label: t("adm_activity_signups", lang) },
    { key: "edit", label: t("adm_activity_edits", lang) },
    { key: "admin", label: t("adm_activity_admin", lang) },
  ];

  return (
    <div>
      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => changeFilter(f.key)}
            className={`min-h-[36px] rounded-[var(--r-pill)] px-3.5 py-1.5 text-[13px] font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
              filter === f.key
                ? "bg-[var(--maroon)] text-[#F4E3C1] shadow-[0_2px_8px_rgba(110,30,42,0.25)]"
                : "border border-[#ECE0C8] bg-[var(--raised)] text-[var(--maroon)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading && rows.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--cream-panel)]" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[var(--cream-panel)]" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-8 text-center">
          <p className="text-[var(--muted)]">{t("adm_no_activity", lang)}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const iconPath =
              ACTION_ICONS[row.action] || ACTION_ICONS["edit"];
            const verbKey = verbKeyFor(row);
            const targetName = bi(
              row.target_name,
              row.target_name_en,
              lang
            );

            // What changed — present only on rows recorded with field data.
            // Lower-cased in English because these read mid-sentence here,
            // unlike the title-cased list in the member History panel.
            const fieldLabels = changedFieldLabels(extractChangedFields(row.details), lang)
              .map((label) => (lang === "en" ? label.toLowerCase() : label));
            const shownLabels = fieldLabels.slice(0, MAX_FIELD_LABELS);
            const extraCount = fieldLabels.length - shownLabels.length;

            return (
              <div
                key={row.id}
                className="flex items-start gap-3 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-3.5"
              >
                {/* Icon */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(201,150,46,0.12)" }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-[18px] w-[18px] text-[var(--gold-deep)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={iconPath}
                    />
                  </svg>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm break-words text-[var(--maroon-deep)]">
                    <span className="font-medium">
                      {row.actor || (lang === "en" ? "System" : "सिस्टम")}
                    </span>{" "}
                    <span className="text-[var(--muted)]">
                      {t(verbKey, lang)}
                    </span>
                    {targetName && (
                      <>
                        {" "}
                        <span className="font-medium">{targetName}</span>
                        {row.target_id && (
                          <span className="ml-1 text-[11px] text-[var(--muted)]">
                            ({row.target_id})
                          </span>
                        )}
                      </>
                    )}
                    {shownLabels.length > 0 && (
                      <>
                        <span className="text-[var(--muted)]"> — </span>
                        <span className="font-medium text-[var(--gold-deep)]">
                          {shownLabels.join(", ")}
                          {extraCount > 0 &&
                            `, ${t("adm_feed_more", lang).replace("{n}", String(extraCount))}`}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {relativeTime(row.at, lang)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {rows.length > 0 && rows.length < total && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="min-h-[44px] rounded-[var(--r)] border border-[#ECE0C8] bg-[var(--raised)] px-6 py-2 text-sm font-medium text-[var(--maroon)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)] disabled:opacity-50"
          >
            {loading ? t("adm_loading", lang) : t("adm_load_more", lang)}
          </button>
        </div>
      )}
    </div>
  );
}
