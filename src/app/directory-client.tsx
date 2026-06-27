"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
      <header
        className="sticky top-0 z-10 border-b border-[var(--hairline)] px-4 pb-3 shadow-[var(--shadow-header)]"
        style={{ background: "linear-gradient(180deg, #33121a, var(--ink))", paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="shrink-0">
              <Crest size={26} />
            </div>
            <h1 className="truncate font-display text-[16px] font-semibold text-[#F4E3C1]">
              {t("app_title", lang)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              onClick={() => router.push("/profile")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] overflow-hidden motion-safe:transition-opacity motion-safe:duration-[var(--dur-fast)] hover:opacity-80"
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
        <div className="relative mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t("search_placeholder", lang)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-[var(--raised)] py-3 pl-10 pr-4 text-[var(--maroon-deep)] placeholder-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
          />
        </div>

        {/* Filter row */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => {
              setFilterType("all");
              setFilterValue("");
            }}
            className={`min-h-[44px] flex-1 whitespace-nowrap rounded-[var(--r-sm)] px-3 py-1.5 text-sm font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
              filterType === "all"
                ? "bg-[var(--maroon)] text-[#F4E3C1] shadow-[0_2px_8px_rgba(110,30,42,0.25)]"
                : "border border-[#ECE0C8] bg-[var(--raised)] text-[var(--maroon)]"
            }`}
          >
            {t("filter_all", lang)} <span className="text-[13px] opacity-80">({members.length})</span>
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
            className={`min-h-[44px] flex-1 rounded-[var(--r-sm)] px-3 py-1.5 text-sm font-medium appearance-none cursor-pointer focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
              filterType === "city"
                ? "bg-[var(--maroon)] text-[#F4E3C1] shadow-[0_2px_8px_rgba(110,30,42,0.25)]"
                : "border border-[#ECE0C8] bg-[var(--raised)] text-[var(--maroon)]"
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
            className={`min-h-[44px] flex-1 rounded-[var(--r-sm)] px-3 py-1.5 text-sm font-medium appearance-none cursor-pointer focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
              filterType === "gotra"
                ? "bg-[var(--maroon)] text-[#F4E3C1] shadow-[0_2px_8px_rgba(110,30,42,0.25)]"
                : "border border-[#ECE0C8] bg-[var(--raised)] text-[var(--maroon)]"
            }`}
          >
            <option value="">🔱 {t("filter_gotra", lang)}</option>
            {gotras.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Results count */}
        <p className="mb-4 font-display text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--maroon)]">{filtered.length}</span>{" "}
          {t("members_found", lang)}
        </p>

        {/* Member list with lineage thread */}
        <div className="relative">
          {/* Gold vertical thread */}
          <div
            className="absolute left-[8px] sm:left-[14px] top-0 bottom-0 w-[2px] opacity-70"
            style={{ background: "linear-gradient(to bottom, transparent, var(--gold) 6%, var(--gold) 94%, transparent)" }}
          />

          <StaggerList className="space-y-2 sm:space-y-[10px]">
            {filtered.map((member, idx) => {
              const name = bi(member.full_name, member.full_name_en, lang);
              const city = bi(member.city, member.city_en, lang);
              const gotra = bi(member.gotra, member.gotra_en, lang);

              const cardEl = (
                <div className="relative pl-[18px] sm:pl-[24px]">
                  {/* Diamond node */}
                  <div className="absolute left-[4px] sm:left-[10px] top-1/2 z-[1] h-[8px] w-[8px] sm:h-[9px] sm:w-[9px] -translate-y-1/2 rotate-45 border-[1.5px] border-[var(--gold)] bg-[var(--paper)]" />
                  {/* Tick connecting node → card */}
                  <div className="absolute left-[10px] sm:left-[14px] top-1/2 h-px w-[8px] sm:w-[10px] -translate-y-1/2 bg-[var(--gold)] opacity-60" />

                  <Link
                    href={`/family/${member.member_id}`}
                    prefetch
                    className="flex w-full items-center gap-2.5 sm:gap-3 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-3.5 sm:px-[15px] sm:py-[14px] text-left shadow-card motion-safe:transition-[transform,box-shadow] motion-safe:duration-[var(--dur)] motion-safe:[transition-timing-function:var(--ease-out)] hover:-translate-y-[3px] hover:shadow-lift"
                  >
                    {/* Avatar */}
                    {member.photo_url ? (
                      <img
                        src={member.photo_url}
                        alt=""
                        className={`h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-full border-[1.5px] border-[var(--gold)] object-cover${
                          member.is_deceased ? " saturate-[.55]" : ""
                        }`}
                      />
                    ) : (
                      <div
                        className={`flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-[var(--cream-panel)] font-display text-[17px] sm:text-[19px] font-bold text-[var(--maroon)]${
                          member.is_deceased
                            ? " border-[var(--gold)]/55 saturate-[.55]"
                            : " border-[var(--gold)]"
                        }`}
                      >
                        {name?.charAt(0) || "?"}
                      </div>
                    )}

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[17px] sm:text-[18px] font-semibold text-[var(--maroon-deep)]">
                        {name}
                      </p>
                      <div className="mt-[2px] flex flex-wrap items-center gap-x-1.5 text-[13px] text-[var(--muted)]">
                        {member.is_deceased && (
                          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--gold-deep)]">
                            In remembrance
                          </span>
                        )}
                        {member.is_deceased && (city || gotra) && (
                          <span className="text-[var(--gold)] opacity-60">·</span>
                        )}
                        {city && <span>{city}</span>}
                        {city && gotra && (
                          <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--gold)] opacity-80" />
                        )}
                        {gotra && <span>{t("label_gotra", lang)}: {gotra}</span>}
                      </div>
                    </div>

                    {/* Chevron */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 ml-auto text-[var(--gold)] opacity-80"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              );

              return idx < 10 ? (
                <StaggerItem key={member.member_id}>{cardEl}</StaggerItem>
              ) : (
                <div key={member.member_id}>{cardEl}</div>
              );
            })}
          </StaggerList>
        </div>

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
