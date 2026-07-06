"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import { Crest } from "@/components/Crest";
import { validateImage, uploadPhoto, createPreviewUrl } from "@/lib/photo-utils";
import { resolveMyMember } from "@/lib/resolve-my-member";
import BottomNav from "@/app/bottom-nav";
import InitialsAvatar from "@/components/form/InitialsAvatar";

interface UserProfile {
  email: string;
  memberId: string | null;
  memberName: string | null;
  memberNameEn: string | null;
  city: string | null;
  cityEn: string | null;
  photoUrl: string | null;
  familyId: string | null;
}

export default function ProfilePage() {
  const { lang, toggleLang } = useLang();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { memberId: headMemberId, familyId } = await resolveMyMember(supabase);

      let memberData = null;
      if (headMemberId) {
        const { data } = await supabase
          .from("members")
          .select("full_name, full_name_en, city, city_en, photo_url")
          .eq("member_id", headMemberId)
          .single();
        memberData = data;
      }

      if (!cancelled) {
        setProfile({
          email: user.email || "",
          memberId: headMemberId,
          memberName: memberData?.full_name || null,
          memberNameEn: memberData?.full_name_en || null,
          city: memberData?.city || null,
          cityEn: memberData?.city_en || null,
          photoUrl: memberData?.photo_url || null,
          familyId: familyId,
        });
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  async function handlePhotoChange(file: File) {
    setPhotoError(null);
    const err = validateImage(file);
    if (err) {
      setPhotoError(err === "photo_too_large" ? t("photo_too_large", lang) : err);
      setTimeout(() => setPhotoError(null), 4000);
      return;
    }
    if (!profile?.familyId || !profile?.memberId) return;

    setPhotoPreview(createPreviewUrl(file));
    setUploading(true);
    try {
      const url = await uploadPhoto(file, profile.familyId, "members", profile.memberId);
      const { error: updateErr } = await supabase.from("members").update({ photo_url: url }).eq("member_id", profile.memberId);
      if (updateErr) {
        setPhotoError(t("photo_upload_failed", lang));
        setTimeout(() => setPhotoError(null), 4000);
      } else {
        setProfile((p) => p ? { ...p, photoUrl: url } : p);
      }
      setPhotoPreview(null);
    } catch {
      setPhotoError(t("photo_upload_failed", lang));
      setTimeout(() => setPhotoError(null), 4000);
      setPhotoPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)]">
        <p className="text-[var(--muted)]">{t("tree_loading", lang)}</p>
      </div>
    );
  }

  const name = bi(profile?.memberName ?? null, profile?.memberNameEn ?? null, lang);
  const city = bi(profile?.city ?? null, profile?.cityEn ?? null, lang);
  const photoSrc = photoPreview || profile?.photoUrl;

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-24 md:ml-[240px] md:pb-8">
      {/* Entrance animation */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .fade-up   { animation: fadeUp var(--dur) var(--ease-out) both; }
          .fade-up-d { animation: fadeUp var(--dur) var(--ease-out) .1s both; }
          .fade-up-d2 { animation: fadeUp var(--dur) var(--ease-out) .18s both; }
        }
      `}</style>

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
            {t("profile_title", lang)}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg md:max-w-2xl px-5 pt-6">
        {/* ── IDENTITY HERO ──────────────────────────────────────── */}
        <div className="fade-up flex flex-col items-center">
          <div className="relative">
            <InitialsAvatar
              name={profile?.memberName || ""}
              nameEn={profile?.memberNameEn}
              photoUrl={photoSrc}
              size="lg"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhotoChange(f);
                e.target.value = "";
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-2 text-[13px] font-medium text-[var(--gold-deep)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:text-[var(--maroon)] disabled:opacity-50"
          >
            {photoSrc ? (lang === "en" ? "Change Picture" : "फ़ोटो बदलें") : (lang === "en" ? "Upload Picture" : "फ़ोटो अपलोड करें")}
          </button>
          {photoError && (
            <p className="mt-1.5 text-[13px] text-[var(--maroon)]">{photoError}</p>
          )}
          <h2 className="mt-4 font-display text-2xl font-semibold text-[var(--maroon-deep)]">
            {name || t("profile_your_account", lang)}
          </h2>
          {city && (
            <p className="mt-1 text-sm text-[var(--muted)]">{city}</p>
          )}
        </div>

        {/* ── ACCOUNT INFO ───────────────────────────────────────── */}
        <div className="fade-up-d mt-8">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {t("profile_account_info", lang)}
          </h3>
          <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] py-2.5">
              <span className="shrink-0 text-sm text-[var(--muted)]">{t("profile_login_email", lang)}</span>
              <span className="truncate text-sm font-medium text-[var(--maroon-deep)]">{profile?.email}</span>
            </div>
            {profile?.memberId && (
              <div className="flex justify-between py-2.5">
                <span className="text-sm text-[var(--muted)]">{t("profile_member_id", lang)}</span>
                <span className="text-sm font-medium tracking-wide text-[var(--muted)]">{profile.memberId}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── SETTINGS ───────────────────────────────────────────── */}
        <div className="fade-up-d mt-6">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {t("profile_settings", lang)}
          </h3>
          <div className="rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-[var(--muted)]">{t("profile_language", lang)}</span>
              <div className="flex overflow-hidden rounded-[var(--r-sm)] border border-[#ECE0C8]">
                <button
                  onClick={() => { if (lang !== "en") toggleLang(); }}
                  className={`px-4 py-1.5 text-sm font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                    lang === "en"
                      ? "bg-[var(--maroon)] text-[var(--ivory)]"
                      : "bg-[var(--raised)] text-[var(--maroon-deep)] hover:bg-[var(--cream-panel)]"
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => { if (lang !== "hi") toggleLang(); }}
                  className={`px-4 py-1.5 text-sm font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                    lang === "hi"
                      ? "bg-[var(--maroon)] text-[var(--ivory)]"
                      : "bg-[var(--raised)] text-[var(--maroon-deep)] hover:bg-[var(--cream-panel)]"
                  }`}
                >
                  हिंदी
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── QUICK ACTIONS ──────────────────────────────────────── */}
        {profile?.memberId && (
          <div className="fade-up-d2 mt-6">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {t("profile_actions", lang)}
            </h3>
            <button
              onClick={() => router.push(`/family/${profile.memberId}?edit=1`)}
              className="flex w-full items-center justify-between rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] px-4 py-3.5 shadow-card motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
            >
              <span className="text-sm font-medium text-[var(--maroon-deep)]">
                {t("profile_edit_details", lang)}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--gold)] opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* ── LOGOUT ─────────────────────────────────────────────── */}
        <button
          onClick={handleLogout}
          className="fade-up-d2 mt-8 min-h-[48px] w-full rounded-[var(--r)] border border-[var(--hairline)] bg-[var(--raised)] text-sm font-medium text-[var(--maroon)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
        >
          {t("logout", lang)}
        </button>

        {/* ── ABOUT / AUTOMIQ ────────────────────────────────────── */}
        <div className="mt-12 flex flex-col items-center pb-4">
          <div className="h-px w-16 bg-[var(--gold)]/25" />
          <div className="mt-6">
            <Crest size={52} />
          </div>
          <p className="mt-4 text-center text-sm text-[var(--gold-deep)]">
            {t("app_title", lang)}
          </p>
          <p className="mt-0.5 text-center text-xs text-[var(--muted)]">
            {t("profile_heritage_line", lang)}
          </p>
          <div className="mt-6 h-px w-8 bg-[var(--gold)]/20" />
          <p className="mt-4 text-xs tracking-wide text-[var(--muted)]">
            {t("about_crafted", lang)}
          </p>
          <a
            href="https://www.automiqlabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 font-display text-base font-semibold text-[var(--maroon)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:text-[var(--gold-deep)]"
          >
            Automiq Labs
          </a>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
