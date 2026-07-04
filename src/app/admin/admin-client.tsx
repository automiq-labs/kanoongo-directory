"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import LanguageToggle from "@/app/language-toggle";
import AdminMemberDetail from "@/components/admin/AdminMemberDetail";
import AdminActivityFeed from "@/components/admin/AdminActivityFeed";
import AdminActivityPopup from "@/components/admin/AdminActivityPopup";
import {
  getNotices,
  postNotice,
  deleteNotice,
  CATEGORY_META,
  type Notice,
  type NoticeCategory,
} from "@/lib/notices";

/* ─── Types ──────────────────────────────────────────────────────────── */

type Tab = "dashboard" | "members" | "activity" | "settings";

interface DashboardData {
  members: number;
  deceased: number;
  active_spouses: number;
  active_children: number;
  claimed_families: number;
  auth_users: number;
  notices: number;
  profiles_complete: number;
  claimed_incomplete: number;
  signups_7d: number;
  logins_7d: number;
  recent_registrations: Array<{
    email: string;
    created_at: string;
    member_id: string | null;
    name: string | null;
    name_en: string | null;
    last_sign_in_at: string | null;
  }>;
}

interface MemberRow {
  member_id: string;
  full_name: string;
  full_name_en: string | null;
  city: string | null;
  city_en: string | null;
  mobile_1: string | null;
  mobile_2: string | null;
  dob: string | null;
  is_deceased: boolean;
  has_photo: boolean;
  profile_complete: boolean;
  claimed: boolean;
  claim_email: string | null;
  last_sign_in_at: string | null;
  edit_blocked: boolean;
}

type MemberFilter = "all" | "claimed" | "unclaimed" | "incomplete" | "complete" | "deceased" | "blocked";

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function relativeTime(iso: string | null, lang: string): string {
  if (!iso) return lang === "en" ? "Never" : "कभी नहीं";
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

/* ─── Component ───────────────────────────────────────────────────────── */

export default function AdminClient() {
  const router = useRouter();
  const { lang } = useLang();
  const supabase = useMemo(() => createClient(), []);

  // Gate
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data, error } = await supabase.rpc("is_admin");
      if (cancelled) return;
      if (error || data !== true) {
        router.replace("/");
      } else {
        setAuthed(true);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [supabase, router]);

  // Tab
  const [tab, setTab] = useState<Tab>("dashboard");

  // ── Dashboard ──────────────────────────────────────────────────────
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    const { data, error } = await supabase.rpc("admin_get_dashboard");
    if (!error && data) setDashboard(data as DashboardData);
    setDashLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching effect, setState in async callback
    if (authed && tab === "dashboard") loadDashboard();
  }, [authed, tab, loadDashboard]);

  // ── Members ────────────────────────────────────────────────────────
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");
  const [memberPage, setMemberPage] = useState(0);
  const [memberLoading, setMemberLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 50;

  // Detail panel
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);

  // Activity popup (signups/logins drill-down from dashboard cards)
  const [popupAction, setPopupAction] = useState<"signup" | "login" | null>(null);

  // Notices section ref for scroll-to
  const noticesSectionRef = useRef<HTMLDivElement>(null);

  const loadMembers = useCallback(
    async (search: string, filter: MemberFilter, page: number) => {
      setMemberLoading(true);
      const { data, error } = await supabase.rpc("admin_list_members", {
        p_search: search.trim() || null,
        p_filter: filter,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (!error && data) {
        const d = data as { total: number; rows: MemberRow[] };
        setMemberRows(d.rows);
        setMemberTotal(d.total);
      }
      setMemberLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching effect, setState in async callback
    if (authed && tab === "members") loadMembers(memberSearch, memberFilter, memberPage);
  }, [authed, tab, memberFilter, memberPage, loadMembers]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchChange(value: string) {
    setMemberSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setMemberPage(0);
      loadMembers(value, memberFilter, 0);
    }, 300);
  }

  function handleFilterChange(f: MemberFilter) {
    setMemberFilter(f);
    setMemberPage(0);
  }

  /** Navigate from a dashboard card to the Members tab with a specific filter. */
  function goToMembersWithFilter(f: MemberFilter) {
    setMemberFilter(f);
    setMemberPage(0);
    setMemberSearch("");
    setTab("members");
    // Trigger a fresh load for the new filter
    loadMembers("", f, 0);
  }

  function dashStatCards(d: DashboardData) {
    return [
      { label: t("adm_stat_members", lang), value: d.members, id: "members" as const },
      { label: t("adm_stat_claimed", lang), value: d.claimed_families, id: "claimed" as const },
      { label: t("adm_stat_complete", lang), value: d.profiles_complete, id: "complete" as const },
      { label: t("adm_stat_incomplete", lang), value: d.claimed_incomplete, highlight: true, id: "incomplete" as const },
      { label: t("adm_stat_signups_7d", lang), value: d.signups_7d, id: "signups" as const },
      { label: t("adm_stat_logins_7d", lang), value: d.logins_7d, id: "logins" as const },
      { label: t("adm_stat_deceased", lang), value: d.deceased, id: "deceased" as const },
      { label: t("adm_stat_notices", lang), value: d.notices, id: "notices" as const },
    ];
  }

  function handleStatCardClick(id: string) {
    switch (id) {
      case "members": goToMembersWithFilter("all"); break;
      case "claimed": goToMembersWithFilter("claimed"); break;
      case "complete": goToMembersWithFilter("complete"); break;
      case "incomplete": goToMembersWithFilter("incomplete"); break;
      case "deceased": goToMembersWithFilter("deceased"); break;
      case "signups": setPopupAction("signup"); break;
      case "logins": setPopupAction("login"); break;
      case "notices":
        setTab("settings");
        setTimeout(() => noticesSectionRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        break;
    }
  }

  /** Escape a value for CSV: quote-wrap, double internal quotes, neutralize formula injection */
  function csvSafe(val: string | null | undefined): string {
    let s = val || "";
    // Neutralize Excel formula injection: prefix a single-quote if first char is a trigger
    if (s && /^[=+\-@]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  }

  async function handleExportCSV() {
    setExporting(true);
    const { data, error } = await supabase.rpc("admin_list_members", {
      p_search: memberSearch.trim() || null,
      p_filter: memberFilter,
      p_limit: 10000,
      p_offset: 0,
    });
    if (error) {
      setExporting(false);
      window.alert(lang === "en" ? "Export failed — please try again" : "निर्यात विफल — कृपया पुनः प्रयास करें");
      return;
    }
    if (data) {
      const d = data as { total: number; rows: MemberRow[] };
      const header = "member_id,name_hindi,name_english,city,mobile_1,mobile_2,claimed,claim_email,profile_complete,last_sign_in";
      const csvRows = d.rows.map((r) =>
        [
          csvSafe(r.member_id),
          csvSafe(r.full_name),
          csvSafe(r.full_name_en),
          csvSafe(r.city),
          csvSafe(r.mobile_1),
          csvSafe(r.mobile_2),
          r.claimed ? "yes" : "no",
          csvSafe(r.claim_email),
          r.profile_complete ? "yes" : "no",
          r.last_sign_in_at || "",
        ].join(",")
      );
      const csv = "\uFEFF" + header + "\n" + csvRows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `kanoongo-members-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  async function handleToggleEditBlocked(memberId: string, currentBlocked: boolean) {
    // Optimistic update
    setMemberRows((prev) =>
      prev.map((r) => r.member_id === memberId ? { ...r, edit_blocked: !currentBlocked } : r),
    );
    const { error } = await supabase.rpc("admin_set_edit_blocked", {
      p_member_id: memberId,
      p_blocked: !currentBlocked,
    });
    if (error) {
      // Revert on error
      setMemberRows((prev) =>
        prev.map((r) => r.member_id === memberId ? { ...r, edit_blocked: currentBlocked } : r),
      );
    }
  }

  // ── Settings ───────────────────────────────────────────────────────
  const [inviteCode, setInviteCode] = useState("");
  const [newInviteCode, setNewInviteCode] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(false);

  // Notice compose
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [nCategory, setNCategory] = useState<NoticeCategory>("general");
  const [nTitle, setNTitle] = useState("");
  const [nTitleEn, setNTitleEn] = useState("");
  const [nBody, setNBody] = useState("");
  const [nBodyEn, setNBodyEn] = useState("");
  const [nEventDate, setNEventDate] = useState("");
  const [nPosting, setNPosting] = useState(false);
  const [nError, setNError] = useState("");

  // Delete notice
  const [deleteNoticeId, setDeleteNoticeId] = useState<string | null>(null);
  const [deletingNotice, setDeletingNotice] = useState(false);

  const loadSettings = useCallback(async () => {
    // Load invite code
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "invite_code")
      .single();
    if (data) setInviteCode(data.value as string);

    // Load notices
    setNoticesLoading(true);
    const noticeData = await getNotices(supabase);
    setNotices(noticeData);
    setNoticesLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching effect, setState in async callback
    if (authed && tab === "settings") loadSettings();
  }, [authed, tab, loadSettings]);

  async function handleSetInviteCode() {
    if (!newInviteCode.trim()) return;
    const confirmed = window.confirm(t("adm_invite_confirm", lang));
    if (!confirmed) return;
    setInviteLoading(true);
    setInviteMsg("");
    const { error } = await supabase.rpc("admin_set_invite_code", {
      p_code: newInviteCode.trim(),
    });
    if (error) {
      setInviteMsg(error.message);
    } else {
      setInviteCode(newInviteCode.trim());
      setNewInviteCode("");
      setInviteMsg(t("adm_invite_saved", lang));
    }
    setInviteLoading(false);
  }

  async function handlePostNotice() {
    if (nPosting || !nTitle.trim()) return;
    setNPosting(true);
    setNError("");
    const result = await postNotice(supabase, {
      p_category: nCategory,
      p_title: nTitle.trim(),
      p_body: nBody.trim(),
      p_title_en: nTitleEn.trim() || null,
      p_body_en: nBodyEn.trim() || null,
      p_event_date: nEventDate || null,
    });
    if (!result.success) {
      setNError(result.error || t("adm_save_error", lang));
    } else {
      setShowNoticeForm(false);
      setNCategory("general");
      setNTitle("");
      setNTitleEn("");
      setNBody("");
      setNBodyEn("");
      setNEventDate("");
      const fresh = await getNotices(supabase);
      setNotices(fresh);
    }
    setNPosting(false);
  }

  async function handleDeleteNotice(id: string) {
    setDeletingNotice(true);
    const result = await deleteNotice(supabase, id);
    if (result.success) {
      setNotices((prev) => prev.filter((n) => n.id !== id));
    }
    setDeleteNoticeId(null);
    setDeletingNotice(false);
  }

  // ── Render gate ────────────────────────────────────────────────────
  if (authed !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(memberTotal / PAGE_SIZE));
  const NOTICE_CATEGORIES: NoticeCategory[] = ["wedding", "birth", "death", "gathering", "general"];

  const tabs: { key: Tab; label: string; icon: string }[] = [
    {
      key: "dashboard",
      label: t("adm_tab_dashboard", lang),
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
    },
    {
      key: "members",
      label: t("adm_tab_members", lang),
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    },
    {
      key: "activity",
      label: t("adm_tab_activity", lang),
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      key: "settings",
      label: t("adm_tab_settings", lang),
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    },
  ];

  const filterChips: { key: MemberFilter; label: string }[] = [
    { key: "all", label: t("adm_filter_all", lang) },
    { key: "claimed", label: t("adm_filter_claimed", lang) },
    { key: "unclaimed", label: t("adm_filter_unclaimed", lang) },
    { key: "incomplete", label: t("adm_filter_incomplete", lang) },
    { key: "complete", label: t("adm_filter_complete", lang) },
    { key: "deceased", label: t("adm_filter_deceased", lang) },
    { key: "blocked", label: t("adm_filter_blocked", lang) },
  ];

  const inputClass =
    "min-h-[44px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-sm text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none";

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 border-b border-[var(--hairline)] px-4 pb-3 shadow-[var(--shadow-header)]"
        style={{
          background: "linear-gradient(180deg, #33121a, var(--ink))",
          paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="font-display text-[16px] font-semibold text-[#F4E3C1]">
            {lang === "en" ? "Admin Portal" : "व्यवस्थापक पोर्टल"}
          </h1>
          <LanguageToggle />
        </div>
      </header>

      {/* ── Tab bar (scrollable on mobile) ──────────────────────── */}
      <div className="sticky top-[52px] z-10 border-b border-[var(--hairline)] bg-[var(--cream)]" style={{ top: "calc(52px + max(0px, env(safe-area-inset-top, 0px)))" }}>
        <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 py-2 scrollbar-none">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-[var(--r-pill)] px-3.5 py-2 text-[13px] font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                tab === tb.key
                  ? "bg-[var(--maroon)] text-[#F4E3C1] shadow-[0_2px_8px_rgba(110,30,42,0.25)]"
                  : "text-[var(--maroon)] hover:bg-[var(--cream-panel)]"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tb.icon} />
              </svg>
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-4 py-5">
        {/* ════════════════════════════════════════════════════════ */}
        {/* DASHBOARD TAB                                           */}
        {/* ════════════════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <>
            {dashLoading && !dashboard ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4">
                    <div className="h-8 w-16 animate-pulse rounded bg-[var(--cream-panel)]" />
                    <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[var(--cream-panel)]" />
                  </div>
                ))}
              </div>
            ) : dashboard ? (
              <>
                {/* Stat cards — all clickable */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {dashStatCards(dashboard).map((stat, i) => (
                    <button
                      key={i}
                      onClick={() => handleStatCardClick(stat.id)}
                      aria-label={`${stat.label}: ${stat.value}`}
                      className={`cursor-pointer rounded-[var(--r)] border bg-[var(--raised)] p-4 text-left shadow-card motion-safe:transition-[transform,box-shadow] motion-safe:duration-[var(--dur)] hover:-translate-y-[2px] hover:shadow-lift ${
                        stat.highlight
                          ? "border-[var(--gold)] ring-1 ring-[var(--gold)]/30"
                          : "border-[#EFE4CD]"
                      }`}
                    >
                      <p className="font-display text-2xl font-bold text-[var(--maroon)]">
                        {stat.value}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">{stat.label}</p>
                    </button>
                  ))}
                </div>

                {/* Recent registrations */}
                <div className="mt-6">
                  <h2 className="font-display text-base font-semibold text-[var(--maroon)] mb-3">
                    {t("adm_recent_registrations", lang)}
                  </h2>
                  {dashboard.recent_registrations.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">{t("adm_no_results", lang)}</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.recent_registrations.map((reg, i) => {
                        const name = bi(reg.name, reg.name_en, lang);
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              if (reg.member_id) {
                                setTab("members");
                                setDetailMemberId(reg.member_id);
                              }
                            }}
                            className="flex w-full items-center gap-3 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-3 text-left shadow-card hover:shadow-lift motion-safe:transition-shadow motion-safe:duration-[var(--dur)]"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--cream-panel)] font-display text-sm font-bold text-[var(--maroon)]">
                              {(name || reg.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[var(--maroon-deep)]">
                                {name || reg.email}
                              </p>
                              <p className="truncate text-xs text-[var(--muted)]">{reg.email}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[11px] text-[var(--muted)]">{relativeTime(reg.created_at, lang)}</p>
                              <p className="text-[11px] text-[var(--muted)]">
                                {t("adm_col_last_login", lang)}: {relativeTime(reg.last_sign_in_at, lang)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* MEMBERS TAB                                             */}
        {/* ════════════════════════════════════════════════════════ */}
        {tab === "members" && (
          <>
            {/* Search + Export */}
            <div className="mb-3 flex gap-2">
              <div className="relative flex-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--muted)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={t("adm_search_placeholder", lang)}
                  className="min-h-[44px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-[var(--raised)] py-2.5 pl-10 pr-4 text-sm text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                />
              </div>
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="flex shrink-0 items-center gap-1.5 min-h-[44px] rounded-[var(--r)] bg-[var(--maroon)] px-4 text-[13px] font-medium text-[var(--ivory)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {exporting ? t("adm_exporting", lang) : t("adm_export_csv", lang)}
              </button>
            </div>

            {/* Filter chips */}
            <div className="mb-4 flex flex-wrap gap-2">
              {filterChips.map((fc) => (
                <button
                  key={fc.key}
                  onClick={() => handleFilterChange(fc.key)}
                  className={`min-h-[36px] rounded-[var(--r-pill)] px-3.5 py-1.5 text-[13px] font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                    memberFilter === fc.key
                      ? "bg-[var(--maroon)] text-[#F4E3C1] shadow-[0_2px_8px_rgba(110,30,42,0.25)]"
                      : "border border-[#ECE0C8] bg-[var(--raised)] text-[var(--maroon)]"
                  }`}
                >
                  {fc.label}
                </button>
              ))}
            </div>

            {/* Results count */}
            <p className="mb-3 text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--maroon)]">{memberTotal}</span>{" "}
              {t("members_found", lang)}
            </p>

            {/* Member list */}
            {memberLoading && memberRows.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--cream-panel)]" />
                    <div className="flex-1">
                      <div className="h-4 w-40 animate-pulse rounded bg-[var(--cream-panel)]" />
                      <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-[var(--cream-panel)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : memberRows.length === 0 ? (
              <div className="rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-8 text-center">
                <p className="text-[var(--muted)]">{t("adm_no_results", lang)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {memberRows.map((row) => {
                  const name = bi(row.full_name, row.full_name_en, lang);
                  const city = bi(row.city, row.city_en, lang);
                  return (
                    <button
                      key={row.member_id}
                      onClick={() => setDetailMemberId(row.member_id)}
                      className="flex w-full items-center gap-3 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-3 text-left shadow-card motion-safe:transition-shadow motion-safe:duration-[var(--dur)] hover:shadow-lift"
                    >
                      {/* Avatar dot or initial */}
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] font-display text-sm font-bold ${
                          row.has_photo
                            ? "border-[var(--gold)] bg-[var(--gold)]/20 text-[var(--gold-deep)]"
                            : "border-[var(--cream-panel)] bg-[var(--cream-panel)] text-[var(--maroon)]"
                        } ${row.is_deceased ? "saturate-[.55]" : ""}`}
                      >
                        {name?.charAt(0) || "?"}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[15px] font-semibold text-[var(--maroon-deep)]">
                          {name}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                          <span>{row.member_id}</span>
                          {city && (
                            <>
                              <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--gold)] opacity-80" />
                              <span>{city}</span>
                            </>
                          )}
                          {row.mobile_1 && (
                            <>
                              <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--gold)] opacity-80" />
                              <a
                                href={`tel:${row.mobile_1}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[var(--gold-deep)] underline underline-offset-2"
                              >
                                {row.mobile_1}
                              </a>
                            </>
                          )}
                        </div>
                        {/* Badges */}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.claimed && (
                            <span className="rounded-[var(--r-pill)] bg-[rgba(201,150,46,0.15)] px-2 py-0.5 text-[10px] font-semibold text-[var(--gold-deep)]">
                              {t("adm_badge_claimed", lang)}
                            </span>
                          )}
                          {row.profile_complete ? (
                            <span className="rounded-[var(--r-pill)] bg-[rgba(34,139,34,0.1)] px-2 py-0.5 text-[10px] font-semibold text-green-700">
                              {t("adm_badge_complete", lang)}
                            </span>
                          ) : (
                            <span className="rounded-[var(--r-pill)] bg-[rgba(138,126,114,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                              {t("adm_badge_incomplete", lang)}
                            </span>
                          )}
                          {row.is_deceased && (
                            <span className="rounded-[var(--r-pill)] bg-[rgba(42,14,18,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink)]">
                              {t("adm_badge_deceased", lang)}
                            </span>
                          )}
                          {row.edit_blocked && (
                            <span className="rounded-[var(--r-pill)] bg-[rgba(110,30,42,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[var(--maroon)]">
                              {t("adm_badge_blocked", lang)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Edit toggle + last sign-in */}
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleEditBlocked(row.member_id, row.edit_blocked); }}
                          title={row.edit_blocked ? t("adm_edit_blocked", lang) : t("adm_edit_allowed", lang)}
                          aria-label={row.edit_blocked ? t("adm_edit_blocked", lang) : t("adm_edit_allowed", lang)}
                          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--cream-panel)]"
                        >
                          {row.edit_blocked ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--maroon)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <p className="text-[11px] text-[var(--muted)]">
                          {relativeTime(row.last_sign_in_at, lang)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => setMemberPage((p) => Math.max(0, p - 1))}
                  disabled={memberPage === 0}
                  className="min-h-[36px] rounded-[var(--r-sm)] border border-[#ECE0C8] bg-[var(--raised)] px-3 py-1 text-xs font-medium text-[var(--maroon)] disabled:opacity-40"
                >
                  {t("adm_prev_page", lang)}
                </button>
                <span className="text-xs text-[var(--muted)]">
                  {memberPage + 1} {t("adm_page_of", lang)} {totalPages}
                </span>
                <button
                  onClick={() => setMemberPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={memberPage >= totalPages - 1}
                  className="min-h-[36px] rounded-[var(--r-sm)] border border-[#ECE0C8] bg-[var(--raised)] px-3 py-1 text-xs font-medium text-[var(--maroon)] disabled:opacity-40"
                >
                  {t("adm_next_page", lang)}
                </button>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* ACTIVITY TAB                                            */}
        {/* ════════════════════════════════════════════════════════ */}
        {tab === "activity" && <AdminActivityFeed supabase={supabase} />}

        {/* ════════════════════════════════════════════════════════ */}
        {/* SETTINGS TAB                                            */}
        {/* ════════════════════════════════════════════════════════ */}
        {tab === "settings" && (
          <>
            {/* Invite code */}
            <div className="mb-6 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-5 shadow-card">
              <h2 className="font-display text-base font-semibold text-[var(--maroon)] mb-1">
                {t("adm_invite_code", lang)}
              </h2>
              <p className="text-xs text-[var(--muted)] mb-3">{t("adm_invite_code_desc", lang)}</p>

              <div className="mb-3 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {t("adm_invite_current", lang)}
                </p>
                <p className="mt-0.5 font-display text-lg font-bold tracking-wider text-[var(--maroon)]">
                  {inviteCode || "—"}
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInviteCode}
                  onChange={(e) => { setNewInviteCode(e.target.value); setInviteMsg(""); }}
                  placeholder={t("adm_invite_new", lang)}
                  className={`${inputClass} flex-1`}
                />
                <button
                  onClick={handleSetInviteCode}
                  disabled={inviteLoading || !newInviteCode.trim()}
                  className="min-h-[44px] shrink-0 rounded-[var(--r)] bg-[var(--maroon)] px-5 text-sm font-medium text-[var(--ivory)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] disabled:opacity-50"
                >
                  {t("adm_invite_save", lang)}
                </button>
              </div>
              {inviteMsg && (
                <p className="mt-2 text-sm text-[var(--maroon)]">{inviteMsg}</p>
              )}
            </div>

            {/* Notices */}
            <div ref={noticesSectionRef} className="rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-[var(--maroon)]">
                  {t("adm_notices_title", lang)}
                </h2>
                <button
                  onClick={() => setShowNoticeForm(!showNoticeForm)}
                  className="min-h-[36px] rounded-[var(--r-sm)] bg-[var(--maroon)] px-4 py-1.5 text-xs font-medium text-[var(--ivory)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)]"
                >
                  {t("adm_notices_post", lang)}
                </button>
              </div>

              {/* Compose form */}
              {showNoticeForm && (
                <div className="mb-4 rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-4">
                  {/* Category */}
                  <div className="mb-3">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {t("adm_notices_category", lang)}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {NOTICE_CATEGORIES.map((cat) => {
                        const meta = CATEGORY_META[cat];
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setNCategory(cat)}
                            className={`flex items-center gap-1 rounded-[var(--r-pill)] px-3 py-1.5 text-xs font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                              nCategory === cat
                                ? "bg-[var(--maroon)] text-[var(--ivory)]"
                                : "border border-[#ECE0C8] bg-[var(--raised)] text-[var(--maroon-deep)]"
                            }`}
                          >
                            <span>{meta.icon}</span>
                            {lang === "en" ? meta.labelEn : meta.labelHi}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title Hindi */}
                  <div className="mb-3">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {t("adm_notices_title_hi", lang)}
                    </label>
                    <input type="text" value={nTitle} onChange={(e) => setNTitle(e.target.value)} className={inputClass} />
                  </div>
                  {/* Title English */}
                  <div className="mb-3">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {t("adm_notices_title_en", lang)}
                    </label>
                    <input type="text" value={nTitleEn} onChange={(e) => setNTitleEn(e.target.value)} className={inputClass} />
                  </div>
                  {/* Body Hindi */}
                  <div className="mb-3">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {t("adm_notices_body_hi", lang)}
                    </label>
                    <textarea value={nBody} onChange={(e) => setNBody(e.target.value)} rows={3} className={`${inputClass} min-h-[80px] resize-y`} />
                  </div>
                  {/* Body English */}
                  <div className="mb-3">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {t("adm_notices_body_en", lang)}
                    </label>
                    <textarea value={nBodyEn} onChange={(e) => setNBodyEn(e.target.value)} rows={3} className={`${inputClass} min-h-[80px] resize-y`} />
                  </div>
                  {/* Event date */}
                  <div className="mb-4">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {t("adm_notices_event_date", lang)}
                    </label>
                    <input type="date" value={nEventDate} onChange={(e) => setNEventDate(e.target.value)} className={inputClass} />
                  </div>

                  {nError && (
                    <p className="mb-3 rounded-[var(--r-sm)] bg-[rgba(110,30,42,0.06)] px-3 py-2 text-sm text-[var(--maroon)]">{nError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNoticeForm(false)}
                      disabled={nPosting}
                      className="min-h-[40px] flex-1 rounded-[var(--r)] border border-[var(--hairline)] bg-[var(--raised)] text-sm font-medium text-[var(--muted)] disabled:opacity-50"
                    >
                      {t("cancel", lang)}
                    </button>
                    <button
                      onClick={handlePostNotice}
                      disabled={nPosting || !nTitle.trim()}
                      className="min-h-[40px] flex-1 rounded-[var(--r)] bg-[var(--maroon)] text-sm font-medium text-[var(--ivory)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] disabled:opacity-50"
                    >
                      {nPosting ? t("notices_posting", lang) : t("notices_post", lang)}
                    </button>
                  </div>
                </div>
              )}

              {/* Notice list */}
              {noticesLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="rounded-[var(--r-sm)] border border-[#EFE4CD] p-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--cream-panel)]" />
                      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[var(--cream-panel)]" />
                    </div>
                  ))}
                </div>
              ) : notices.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{t("adm_notices_none", lang)}</p>
              ) : (
                <div className="space-y-2">
                  {notices.map((notice) => {
                    const title = bi(notice.title, notice.title_en, lang);
                    const meta = CATEGORY_META[notice.category];
                    return (
                      <div
                        key={notice.id}
                        className="flex items-start justify-between rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs">{meta.icon}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                              {lang === "en" ? meta.labelEn : meta.labelHi}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-[var(--maroon-deep)]">{title}</p>
                          {notice.event_date && (
                            <p className="mt-0.5 text-[11px] text-[var(--muted)]">{notice.event_date}</p>
                          )}
                        </div>
                        <div className="ml-3 shrink-0">
                          {deleteNoticeId === notice.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setDeleteNoticeId(null)}
                                disabled={deletingNotice}
                                className="rounded-[var(--r-sm)] border border-[var(--hairline)] px-2 py-1 text-[11px] text-[var(--muted)] disabled:opacity-50"
                              >
                                {t("cancel", lang)}
                              </button>
                              <button
                                onClick={() => handleDeleteNotice(notice.id)}
                                disabled={deletingNotice}
                                className="rounded-[var(--r-sm)] bg-[var(--maroon)] px-2 py-1 text-[11px] text-[var(--ivory)] disabled:opacity-50"
                              >
                                {t("adm_confirm_action", lang)}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteNoticeId(notice.id)}
                              className="text-[11px] font-medium text-[var(--muted)] hover:text-[var(--maroon)]"
                            >
                              {lang === "en" ? "Delete" : "हटाएं"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Member detail panel ─────────────────────────────────── */}
      {detailMemberId && (
        <AdminMemberDetail
          memberId={detailMemberId}
          supabase={supabase}
          onClose={() => setDetailMemberId(null)}
          onRefresh={() => {
            if (tab === "members") loadMembers(memberSearch, memberFilter, memberPage);
            if (tab === "dashboard") loadDashboard();
          }}
        />
      )}

      {/* ── Activity popup (signups / logins drill-down) ──────── */}
      {popupAction && dashboard && (
        <AdminActivityPopup
          action={popupAction}
          supabase={supabase}
          memberIdByEmail={
            // Build email→member_id lookup from dashboard recent_registrations
            Object.fromEntries(
              dashboard.recent_registrations
                .filter((r) => r.member_id)
                .map((r) => [r.email, r.member_id!]),
            )
          }
          onClose={() => setPopupAction(null)}
          onOpenMember={(mid) => {
            setPopupAction(null);
            setDetailMemberId(mid);
          }}
        />
      )}
    </div>
  );
}
