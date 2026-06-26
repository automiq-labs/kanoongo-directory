"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { createClient } from "@/lib/supabase/client";

export default function BottomNav() {
  const { lang } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [myMemberId, setMyMemberId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchMyMember() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: fam } = await supabase
        .from("families")
        .select("head_member_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setMyMemberId(fam?.head_member_id ?? null);
      }
    }
    fetchMyMember();
    return () => {
      cancelled = true;
    };
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
    <nav className="fixed bottom-0 left-0 right-0 border-t border-[var(--border-warm)] bg-white">
      <div className="mx-auto flex max-w-lg">
        {navItems.map((item) => {
          if (!item.href) return null; // hide if not resolved (no linked member)

          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <button
              key={item.labelKey}
              onClick={() => router.push(item.href!)}
              className={`flex flex-1 flex-col items-center py-3 ${
                isActive ? "text-[var(--maroon)]" : "text-[var(--muted)]"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={item.icon}
                />
              </svg>
              <span className="mt-1 truncate text-[10px] font-medium leading-tight">
                {t(item.labelKey, lang)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
