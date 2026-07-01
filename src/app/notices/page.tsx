"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import {
  getNotices,
  postNotice,
  deleteNotice,
  CATEGORY_META,
  type Notice,
  type NoticeCategory,
} from "@/lib/notices";
import LanguageToggle from "@/app/language-toggle";
import BottomNav from "@/app/bottom-nav";
import InitialsAvatar from "@/components/form/InitialsAvatar";
import DateField from "@/components/form/DateField";

// ── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIES: NoticeCategory[] = ["wedding", "birth", "death", "gathering", "general"];

function relativeTime(isoDate: string, lang: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diffSec < 60) return lang === "en" ? "just now" : "अभी";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return lang === "en" ? `${diffMin}m ago` : `${diffMin} मि. पहले`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return lang === "en" ? `${diffHr}h ago` : `${diffHr} घं. पहले`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return lang === "en" ? `${diffDay}d ago` : `${diffDay} दिन पहले`;
  const diffMon = Math.floor(diffDay / 30);
  return lang === "en" ? `${diffMon}mo ago` : `${diffMon} माह पहले`;
}

function chipBg(category: NoticeCategory): string {
  if (category === "death") return "rgba(42,14,18,0.06)";
  const accent = CATEGORY_META[category].accent;
  if (accent === "var(--gold)") return "rgba(201,150,46,0.12)";
  return "rgba(110,30,42,0.08)";
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function NoticesPage() {
  const { lang } = useLang();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose
  const [showCompose, setShowCompose] = useState(false);
  const [composeCategory, setComposeCategory] = useState<NoticeCategory>("general");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeDate, setComposeDate] = useState("");
  const [posting, setPosting] = useState(false);
  const [composeError, setComposeError] = useState("");

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await getNotices(supabase);
      if (!cancelled) {
        setNotices(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // ── Post handler ────────────────────────────────────────────────────────

  async function handlePost() {
    if (posting) return;
    if (!composeTitle.trim()) return;
    setPosting(true);
    setComposeError("");
    try {
      const titleVal = composeTitle.trim();
      const bodyVal = composeBody.trim();
      const result = await postNotice(supabase, {
        p_category: composeCategory,
        p_title: titleVal,
        p_body: bodyVal,
        p_title_en: titleVal,
        p_body_en: bodyVal || null,
        p_event_date: composeDate || null,
      });
      if (!result.success) {
        setComposeError(result.error || t("save_error", lang));
        return;
      }
      // Refresh feed
      const fresh = await getNotices(supabase);
      setNotices(fresh);
      // Reset
      setShowCompose(false);
      setComposeCategory("general");
      setComposeTitle("");
      setComposeBody("");
      setComposeDate("");
    } catch {
      setComposeError(t("save_error", lang));
    } finally {
      setPosting(false);
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(true);
    try {
      const result = await deleteNotice(supabase, id);
      if (result.success) {
        setNotices((prev) => prev.filter((n) => n.id !== id));
      }
      setDeleteConfirmId(null);
    } catch {
      // best-effort
    } finally {
      setDeleting(false);
    }
  }

  // ── Shared styles ───────────────────────────────────────────────────────

  const inputClass =
    "min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none";

  // ── Render ──────────────────────────────────────────────────────────────

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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="flex-1 font-display text-lg font-semibold text-[#F4E3C1]">
            {t("nav_notices", lang)}
          </h1>
          <LanguageToggle />
        </div>
      </header>

      <div className="mx-auto max-w-lg md:max-w-2xl px-5 pt-4">
        {/* ── COMPOSE ────────────────────────────────────────────── */}
        {!showCompose ? (
          <button
            onClick={() => setShowCompose(true)}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--gold)]/40 bg-[var(--raised)] py-3.5 text-sm font-medium text-[var(--gold-deep)] shadow-card motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
          >
            <span className="text-base">✏️</span>
            {t("notices_compose", lang)}
          </button>
        ) : (
          <div className="mb-5 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
            {/* Category */}
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {lang === "en" ? "Category" : "श्रेणी"}
            </label>
            <div className="mb-4 flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const active = composeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setComposeCategory(cat)}
                    className={`flex items-center gap-1 rounded-[var(--r-pill)] px-3 py-1.5 text-xs font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                      active
                        ? "bg-[var(--maroon)] text-[var(--ivory)]"
                        : "border border-[#ECE0C8] bg-[var(--raised)] text-[var(--maroon-deep)] hover:bg-[var(--cream-panel)]"
                    }`}
                  >
                    <span>{meta.icon}</span>
                    {lang === "en" ? meta.labelEn : meta.labelHi}
                  </button>
                );
              })}
            </div>

            {/* Title */}
            <div className="mb-3">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {lang === "en" ? "Title" : "शीर्षक"}
              </label>
              <input
                type="text"
                value={composeTitle}
                onChange={(e) => setComposeTitle(e.target.value)}
                placeholder={lang === "en" ? "Announcement title" : "सूचना शीर्षक"}
                className={inputClass}
              />
            </div>

            {/* Message */}
            <div className="mb-3">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {lang === "en" ? "Message (optional)" : "संदेश (वैकल्पिक)"}
              </label>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={3}
                className={`${inputClass} min-h-[80px] resize-y`}
              />
            </div>

            {/* Event date */}
            <div className="mb-4">
              <DateField
                label={lang === "en" ? "Event Date (optional)" : "कार्यक्रम तिथि (वैकल्पिक)"}
                value={composeDate}
                onChange={setComposeDate}
              />
            </div>

            {/* Error */}
            {composeError && (
              <div
                className="mb-3 rounded-[var(--r-sm)] px-4 py-2.5 text-sm font-medium text-[var(--maroon-deep)]"
                style={{ background: "rgba(110,30,42,0.06)" }}
              >
                {composeError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                disabled={posting}
                className="min-h-[44px] flex-1 rounded-[var(--r)] border border-[var(--hairline)] bg-[var(--raised)] text-sm font-medium text-[var(--muted)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)] disabled:opacity-50"
              >
                {t("cancel", lang)}
              </button>
              <button
                type="button"
                onClick={handlePost}
                disabled={posting || !composeTitle.trim()}
                className="min-h-[44px] flex-1 rounded-[var(--r)] bg-[var(--maroon)] text-sm font-medium text-[var(--ivory)] motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)] active:scale-[.98] disabled:opacity-50"
              >
                {posting ? t("notices_posting", lang) : t("notices_post", lang)}
              </button>
            </div>
          </div>
        )}

        {/* ── LOADING SKELETON ───────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4"
              >
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--cream-panel)]" />
                <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-[var(--cream-panel)]" />
                <div className="mt-2 h-4 w-full animate-pulse rounded bg-[var(--cream-panel)]" />
              </div>
            ))}
          </div>
        )}

        {/* ── EMPTY STATE ────────────────────────────────────────── */}
        {!loading && notices.length === 0 && !showCompose && (
          <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-8 text-center shadow-card">
            <p className="text-3xl">📢</p>
            <p className="mt-3 font-display text-base font-semibold text-[var(--maroon-deep)]">
              {t("notices_empty", lang)}
            </p>
            <button
              onClick={() => setShowCompose(true)}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[var(--r)] bg-[var(--maroon)] px-5 text-sm font-medium text-[var(--ivory)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)]"
            >
              {t("notices_compose", lang)}
            </button>
          </div>
        )}

        {/* ── FEED ───────────────────────────────────────────────── */}
        {!loading && (
          <div className="space-y-3">
            {notices.map((notice) => {
              const meta = CATEGORY_META[notice.category];
              const title = bi(notice.title, notice.title_en, lang);
              const body = bi(notice.body, notice.body_en, lang);
              const posterName = bi(
                notice.poster_name,
                notice.poster_name_en,
                lang
              );
              const isDeath = notice.category === "death";

              return (
                <div
                  key={notice.id}
                  className={`rounded-[var(--r-lg)] border bg-[var(--raised)] p-4 shadow-card ${
                    isDeath ? "border-[var(--muted)]/30" : "border-[#EFE4CD]"
                  }`}
                >
                  {/* Category chip */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-[var(--r-pill)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                      isDeath
                        ? "text-[var(--muted)]"
                        : "text-[var(--maroon-deep)]"
                    }`}
                    style={{ background: chipBg(notice.category) }}
                  >
                    <span>{meta.icon}</span>
                    {lang === "en" ? meta.labelEn : meta.labelHi}
                  </span>

                  {/* Title */}
                  <h3
                    className={`mt-2 font-display text-base font-semibold ${
                      isDeath
                        ? "text-[var(--ink)]"
                        : "text-[var(--maroon-deep)]"
                    }`}
                  >
                    {title}
                  </h3>

                  {/* Body */}
                  {body && (
                    <p className="mt-1.5 whitespace-pre-line text-sm text-[var(--text-body)]">
                      {body}
                    </p>
                  )}

                  {/* Event date */}
                  {notice.event_date && (
                    <p className="mt-2 text-[13px] text-[var(--muted)]">
                      📅 {notice.event_date}
                    </p>
                  )}

                  {/* Image (rendered if present; upload deferred) */}
                  {notice.image_url && (
                    <img
                      src={notice.image_url}
                      alt=""
                      className="mt-3 w-full rounded-[var(--r)] object-cover"
                      style={{ maxHeight: 280 }}
                    />
                  )}

                  {/* Footer */}
                  <div className="mt-3 flex items-center gap-2 border-t border-[var(--hairline)] pt-2.5">
                    <InitialsAvatar
                      name={notice.poster_name || ""}
                      nameEn={notice.poster_name_en}
                      photoUrl={notice.poster_photo}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--maroon-deep)]">
                        {posterName ||
                          (lang === "en"
                            ? "A family member"
                            : "एक परिवार सदस्य")}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {relativeTime(notice.created_at, lang)}
                      </p>
                    </div>

                    {/* Delete (own notices only) */}
                    {notice.is_mine &&
                      (deleteConfirmId === notice.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            disabled={deleting}
                            className="rounded-[var(--r)] border border-[var(--hairline)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] disabled:opacity-50"
                          >
                            {t("cancel", lang)}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(notice.id)}
                            disabled={deleting}
                            className="rounded-[var(--r)] bg-[var(--maroon)] px-2.5 py-1 text-[11px] font-medium text-[var(--ivory)] disabled:opacity-50"
                          >
                            {deleting ? "…" : t("confirm", lang)}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(notice.id)}
                          className="text-[11px] font-medium text-[var(--muted)] hover:text-[var(--maroon)]"
                        >
                          {lang === "en" ? "Delete" : "हटाएं"}
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
