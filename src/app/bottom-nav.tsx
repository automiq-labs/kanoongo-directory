"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { createClient } from "@/lib/supabase/client";
import { resolveMyMember } from "@/lib/resolve-my-member";

export default function BottomNav() {
  const { lang } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [myMemberId, setMyMemberId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchMyMember() {
      const { memberId } = await resolveMyMember(supabase);
      if (!cancelled) setMyMemberId(memberId);
    }
    fetchMyMember();
    return () => { cancelled = true; };
  }, [supabase]);

  const myFamilyHref = myMemberId ? `/family/${myMemberId}` : null;

  const navItems = [
    {
      href: "/",
      labelKey: "nav_directory" as const,
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
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
    <nav
      className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--hairline)] bg-[var(--raised)]"
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
              <span className="mt-1 truncate text-[11px] font-medium leading-tight">
                {t(item.labelKey, lang)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active-pill entrance animation */}
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
    </nav>
  );
}
