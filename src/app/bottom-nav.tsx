"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import { createClient } from "@/lib/supabase/client";
import { resolveMyMember } from "@/lib/resolve-my-member";
import { Crest } from "@/components/Crest";

export default function BottomNav() {
  const { lang } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{
    photoUrl: string | null;
    fullName: string | null;
    fullNameEn: string | null;
  }>({ photoUrl: null, fullName: null, fullNameEn: null });

  useEffect(() => {
    let cancelled = false;
    async function fetchMyMember() {
      const { memberId } = await resolveMyMember(supabase);
      if (cancelled) return;
      setMyMemberId(memberId);
      if (memberId) {
        const { data: mem } = await supabase
          .from("members")
          .select("full_name, full_name_en, photo_url")
          .eq("member_id", memberId)
          .single();
        if (mem && !cancelled) {
          setUserInfo({
            photoUrl: mem.photo_url,
            fullName: mem.full_name,
            fullNameEn: mem.full_name_en,
          });
        }
      }
    }
    fetchMyMember();
    return () => { cancelled = true; };
  }, [supabase]);

  const myFamilyHref = myMemberId ? `/family/${myMemberId}` : null;
  const userName = bi(userInfo.fullName, userInfo.fullNameEn, lang);
  const userInitial = userName?.charAt(0) || "?";

  const navItems = [
    {
      href: "/",
      labelKey: "nav_directory" as const,
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    },
    {
      href: "/celebrations",
      labelKey: "nav_celebrations" as const,
      icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
    },
    {
      href: "/notices",
      labelKey: "nav_notices" as const,
      icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    },
    {
      href: "/tree",
      labelKey: "nav_tree" as const,
      icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM9 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
    },
    {
      href: myFamilyHref,
      labelKey: "nav_my_family" as const,
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
    },
  ];

  return (
    <>
      {/* ── MOBILE BOTTOM BAR (<md) ──────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--hairline)] bg-[var(--raised)] md:hidden"
        style={{
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -1px 0 rgba(201,150,46,.25)",
        }}
      >
        <div className="mx-auto flex max-w-lg">
          {navItems.map((item) => {
            if (!item.href) return null;

            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <button
                key={item.labelKey}
                onClick={() => router.push(item.href!)}
                className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center pt-3 pb-1 ${
                  isActive ? "text-[var(--maroon)]" : "text-[var(--muted)]"
                }`}
              >
                {/* Icon with active pill behind it */}
                <span className="relative flex items-center justify-center">
                  {isActive && (
                    <span
                      className="nav-pill absolute h-[30px] w-[52px] rounded-full"
                      style={{ background: "rgba(201,150,46,0.14)" }}
                    />
                  )}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="relative h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={item.icon}
                    />
                  </svg>
                </span>
                <span className="mt-1 truncate text-[10px] font-medium leading-tight">
                  {t(item.labelKey, lang)}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── DESKTOP SIDEBAR (md+) ────────────────────────────────── */}
      <aside
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-20 w-[240px] flex-col border-r border-[var(--hairline)]"
        style={{ background: "linear-gradient(180deg, #33121a, var(--ink))" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <Crest size={32} />
          <span className="truncate font-display text-lg font-semibold text-[#F4E3C1]">
            {t("app_title", lang)}
          </span>
        </div>
        <div className="mx-5 h-px bg-[var(--hairline)]" />

        {/* Nav items */}
        <div className="flex-1 space-y-1 px-3 pt-4">
          {navItems.map((item) => {
            if (!item.href) return null;

            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <button
                key={item.labelKey}
                onClick={() => router.push(item.href!)}
                className={`relative flex min-h-[44px] w-full items-center gap-3 rounded-[var(--r)] px-3 text-left motion-safe:transition-[background-color,color] motion-safe:duration-[var(--dur-fast)] ${
                  isActive
                    ? "text-[#F4E3C1]"
                    : "text-[#F4E3C1]/60 hover:text-[#F4E3C1]/90"
                }`}
                style={isActive ? { background: "rgba(201,150,46,0.14)" } : undefined}
              >
                {/* Active left marker */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-[24px] w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--gold)]" />
                )}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={item.icon}
                  />
                </svg>
                <span className="text-[14px] font-medium">
                  {t(item.labelKey, lang)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Profile section (pinned bottom) */}
        <div className="mt-auto border-t border-[var(--hairline)] px-3 pt-3 pb-4">
          <button
            onClick={() => router.push("/profile")}
            className="flex w-full items-center gap-3 rounded-[var(--r)] px-3 py-2.5 text-left motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-white/5"
          >
            {userInfo.photoUrl ? (
              <img
                src={userInfo.photoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full border-[1.5px] border-[var(--gold)] object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] bg-[var(--cream-panel)] font-display text-sm font-bold text-[var(--maroon)]">
                {userInitial}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[#F4E3C1]">
                {userName || t("profile_title", lang)}
              </span>
            </span>
          </button>
          <p className="mt-2 px-3 text-[10px] tracking-wide text-[#F4E3C1]/30">
            Built by Automiq Labs
          </p>
        </div>
      </aside>

      {/* Animations */}
      <style>{`
        @keyframes pillIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        .nav-pill {
          animation: pillIn var(--dur) var(--ease-out) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .nav-pill { animation: none; }
        }
      `}</style>
    </>
  );
}
