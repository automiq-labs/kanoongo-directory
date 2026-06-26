"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import { Crest } from "@/components/Crest";
import { MakerMark } from "@/components/MakerMark";
import { validateImage, uploadPhoto, createPreviewUrl } from "@/lib/photo-utils";
import LanguageToggle from "@/app/language-toggle";
import BottomNav from "@/app/bottom-nav";

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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: fam } = await supabase
        .from("families")
        .select("id, head_member_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      let memberData = null;
      if (fam?.head_member_id) {
        const { data } = await supabase
          .from("members")
          .select("full_name, full_name_en, city, city_en, photo_url")
          .eq("member_id", fam.head_member_id)
          .single();
        memberData = data;
      }

      if (!cancelled) {
        setProfile({
          email: user.email || "",
          memberId: fam?.head_member_id || null,
          memberName: memberData?.full_name || null,
          memberNameEn: memberData?.full_name_en || null,
          city: memberData?.city || null,
          cityEn: memberData?.city_en || null,
          photoUrl: memberData?.photo_url || null,
          familyId: fam?.id || null,
        });
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  async function handlePhotoChange(file: File) {
    const err = validateImage(file);
    if (err) return;
    if (!profile?.familyId || !profile?.memberId) return;

    setPhotoPreview(createPreviewUrl(file));
    setUploading(true);
    try {
      const url = await uploadPhoto(file, profile.familyId, "members", profile.memberId);
      await supabase.from("members").update({ photo_url: url }).eq("member_id", profile.memberId);
      setProfile((p) => p ? { ...p, photoUrl: url } : p);
      setPhotoPreview(null);
    } catch (e) {
      console.error("Photo upload failed:", e);
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
    <div className="min-h-screen bg-[var(--cream)] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--gold)]/20 bg-[var(--maroon)] px-5 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--gold)] hover:bg-[var(--maroon-deep)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 font-display text-lg font-semibold text-[var(--ivory)]">
            {t("profile_title", lang)}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-5 pt-6">
        {/* Identity header */}
        <div className="flex flex-col items-center">
          <div className="relative">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt=""
                className="h-24 w-24 rounded-full border-3 border-[var(--gold)]/40 object-cover cursor-pointer"
                onClick={() => fileRef.current?.click()}
              />
            ) : (
              <div
                className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-full border-3 border-[var(--gold)]/40 bg-[var(--ivory)] font-display text-3xl font-bold text-[var(--maroon)]"
                onClick={() => fileRef.current?.click()}
              >
                {name?.charAt(0) || "?"}
              </div>
            )}
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
          <h2 className="mt-4 font-display text-2xl font-semibold text-[var(--maroon-deep)]">
            {name || t("profile_your_account", lang)}
          </h2>
          {city && (
            <p className="mt-1 text-sm text-[var(--gold-deep)]">{city}</p>
          )}
        </div>

        {/* Account info */}
        <div className="mt-8">
          <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-[var(--gold-deep)]">
            {t("profile_account_info", lang)}
          </h3>
          <div className="rounded-[12px] border border-[var(--border-card)] bg-white p-4 shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-warm)] py-2.5">
              <span className="shrink-0 text-sm text-[var(--gold-deep)]">{t("profile_login_email", lang)}</span>
              <span className="truncate text-sm font-medium text-[var(--maroon-deep)]">{profile?.email}</span>
            </div>
            {profile?.memberId && (
              <div className="flex justify-between py-2.5">
                <span className="text-sm text-[var(--gold-deep)]">{t("profile_member_id", lang)}</span>
                <span className="text-sm font-medium text-[var(--muted)]">{profile.memberId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="mt-6">
          <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-[var(--gold-deep)]">
            {t("profile_settings", lang)}
          </h3>
          <div className="rounded-[12px] border border-[var(--border-card)] bg-white p-4 shadow-[0_1px_3px_rgba(110,30,42,0.06)]">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-[var(--gold-deep)]">{t("profile_language", lang)}</span>
              <div className="flex overflow-hidden rounded-lg border border-[var(--border-warm)]">
                <button
                  onClick={() => { if (lang !== "en") toggleLang(); }}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    lang === "en"
                      ? "bg-[var(--maroon)] text-[var(--ivory)]"
                      : "bg-white text-[var(--maroon-deep)] hover:bg-[var(--cream-panel)]"
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => { if (lang !== "hi") toggleLang(); }}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    lang === "hi"
                      ? "bg-[var(--maroon)] text-[var(--ivory)]"
                      : "bg-white text-[var(--maroon-deep)] hover:bg-[var(--cream-panel)]"
                  }`}
                >
                  हिंदी
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        {profile?.memberId && (
          <div className="mt-6">
            <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-[var(--gold-deep)]">
              {t("profile_actions", lang)}
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push(`/family/${profile.memberId}?edit=1`)}
                className="flex w-full items-center justify-between rounded-[12px] border border-[var(--border-card)] bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(110,30,42,0.06)] transition-colors hover:bg-[var(--cream-panel)]"
              >
                <span className="text-sm font-medium text-[var(--maroon-deep)]">
                  {t("profile_edit_details", lang)}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="mt-8 w-full rounded-[12px] border border-[var(--border-warm)] py-3 text-sm font-medium text-[var(--maroon)] transition-colors hover:bg-[var(--cream-panel)]"
        >
          {t("logout", lang)}
        </button>

        {/* About / Automiq moment */}
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
            className="mt-1 font-display text-base font-semibold text-[var(--maroon)] transition-colors hover:text-[var(--gold-deep)]"
          >
            Automiq Labs
          </a>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
