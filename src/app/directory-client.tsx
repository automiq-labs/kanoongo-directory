"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Member } from "@/lib/types";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import LanguageToggle from "./language-toggle";
import BottomNav from "./bottom-nav";
import { Crest } from "@/components/Crest";
import { resolveMyMember } from "@/lib/resolve-my-member";
import { StaggerList, StaggerItem } from "@/components/Motion";

type DirectoryMember = Pick<
  Member,
  | "member_id"
  | "full_name"
  | "full_name_en"
  | "city"
  | "city_en"
  | "gotra"
  | "gotra_en"
  | "is_deceased"
  | "photo_url"
>;

export default function DirectoryClient({
  members,
}: {
  members: DirectoryMember[];
}) {
  const router = useRouter();
  const { lang } = useLang();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "city" | "gotra">("all");
  const [filterValue, setFilterValue] = useState("");

  const supabaseCl = useMemo(() => createClient(), []);
  const [userAvatar, setUserAvatar] = useState<{ photoUrl: string | null; initial: string }>({ photoUrl: null, initial: "?" });

  useEffect(() => {
    let cancelled = false;
    async function loadAvatar() {
      const { memberId } = await resolveMyMember(supabaseCl);
      if (cancelled) return;
      if (memberId) {
        const { data: mem } = await supabaseCl.from("members").select("full_name, full_name_en, photo_url").eq("member_id", memberId).single();
        if (mem && !cancelled) {
          const n = lang === "en" ? (mem.full_name_en || mem.full_name) : mem.full_name;
          setUserAvatar({ photoUrl: mem.photo_url, initial: n?.charAt(0) || "?" });
        }
      }
    }
    loadAvatar();
    return () => { cancelled = true; };
  }, [supabaseCl, lang]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      const city = bi(m.city, m.city_en, lang);
      if (city) set.add(city);
    });
    return Array.from(set).sort();
  }, [members, lang]);

  const gotras = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      const gotra = bi(m.gotra, m.gotra_en, lang);
      if (gotra) set.add(gotra);
    });
    return Array.from(set).sort();
  }, [members, lang]);

  // Reset filter value when language changes (filter values are language-specific strings)
  const filtered = useMemo(() => {
    let result = members;

    if (filterType === "city" && filterValue) {
      result = result.filter((m) => bi(m.city, m.city_en, lang) === filterValue);
    } else if (filterType === "gotra" && filterValue) {
      result = result.filter((m) => bi(m.gotra, m.gotra_en, lang) === filterValue);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((m) => {
        const name = bi(m.full_name, m.full_name_en, lang);
        const city = bi(m.city, m.city_en, lang);
        const gotra = bi(m.gotra, m.gotra_en, lang);
        return (
          name?.toLowerCase().includes(q) ||
          city?.toLowerCase().includes(q) ||
          gotra?.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [members, search, filterType, filterValue, lang]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--gold)]/20 bg-[var(--maroon)] px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="shrink-0">
              <Crest size={26} />
            </div>
            <h1 className="truncate font-display text-[15px] font-semibold text-[var(--ivory)]">
              {t("app_title", lang)}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <button
              onClick={() => router.push("/profile")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[var(--gold)]/40 overflow-hidden transition-opacity hover:opacity-80"
            >
              {userAvatar.photoUrl ? (
                <img src={userAvatar.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[var(--ivory)] font-display text-sm font-bold text-[var(--maroon)]">
                  {userAvatar.initial}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            placeholder={t("search_placeholder", lang)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--border-warm)] bg-white px-4 py-3 text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20 focus:outline-none"
          />
        </div>

        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setFilterType("all");
              setFilterValue("");
            }}
            className={`min-h-[36px] rounded-[20px] px-3 py-1.5 text-sm font-medium transition-colors ${
              filterType === "all"
                ? "bg-[var(--maroon)] text-[var(--ivory)]"
                : "bg-white text-[var(--maroon)] border border-[var(--border-warm)]"
            }`}
          >
            {t("filter_all", lang)} ({members.length})
          </button>

          <select
            value={filterType === "city" ? filterValue : ""}
            onChange={(e) => {
              if (e.target.value) {
                setFilterType("city");
                setFilterValue(e.target.value);
              } else {
                setFilterType("all");
                setFilterValue("");
              }
            }}
            className={`min-h-[36px] rounded-[20px] px-3 py-1.5 text-sm font-medium transition-colors appearance-none cursor-pointer ${
              filterType === "city"
                ? "bg-[var(--maroon)] text-[var(--ivory)]"
                : "bg-white text-[var(--maroon)] border border-[var(--border-warm)]"
            }`}
          >
            <option value="">🏙️ {t("filter_city", lang)}</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filterType === "gotra" ? filterValue : ""}
            onChange={(e) => {
              if (e.target.value) {
                setFilterType("gotra");
                setFilterValue(e.target.value);
              } else {
                setFilterType("all");
                setFilterValue("");
              }
            }}
            className={`min-h-[36px] rounded-[20px] px-3 py-1.5 text-sm font-medium transition-colors appearance-none cursor-pointer ${
              filterType === "gotra"
                ? "bg-[var(--maroon)] text-[var(--ivory)]"
                : "bg-white text-[var(--maroon)] border border-[var(--border-warm)]"
            }`}
          >
            <option value="">🔱 {t("filter_gotra", lang)}</option>
            {gotras.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Results count */}
        <p className="mb-3 text-sm text-[var(--gold-deep)]">
          {filtered.length} {t("members_found", lang)}
        </p>

        {/* Member cards */}
        <StaggerList className="space-y-[10px]">
          {filtered.map((member, idx) => {
            const name = bi(member.full_name, member.full_name_en, lang);
            const city = bi(member.city, member.city_en, lang);
            const gotra = bi(member.gotra, member.gotra_en, lang);

            const cardEl = (
              <button
                onClick={() => router.push(`/family/${member.member_id}`)}
                className="flex w-full items-center gap-3 rounded-[12px] border border-[var(--border-card)] bg-white p-4 text-left shadow-[0_1px_3px_rgba(110,30,42,0.06)] transition-shadow hover:shadow-md active:bg-[var(--cream-panel)]"
              >
                {member.photo_url ? (
                  <img src={member.photo_url} alt="" className="h-[46px] w-[46px] shrink-0 rounded-full border-2 border-[var(--gold)]/30 object-cover" />
                ) : (
                  <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--gold)]/30 bg-[var(--ivory)] font-display text-lg font-bold text-[var(--maroon)]">
                    {name?.charAt(0) || "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[18px] font-semibold text-[var(--maroon-deep)]">
                    {name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-[var(--gold-deep)]">
                    {city && <span>{city}</span>}
                    {gotra && <span>{t("label_gotra", lang)}: {gotra}</span>}
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-[var(--gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );

            return idx < 10 ? (
              <StaggerItem key={member.member_id}>{cardEl}</StaggerItem>
            ) : (
              <div key={member.member_id}>{cardEl}</div>
            );
          })}
        </StaggerList>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-[var(--muted)]">
            <p className="text-lg">{t("no_members", lang)}</p>
            <p className="mt-1 text-sm">{t("no_members_hint", lang)}</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
