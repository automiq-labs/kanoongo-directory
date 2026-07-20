"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
import CelebrationsStrip from "@/components/CelebrationsStrip";
import WelcomeCard from "@/components/WelcomeCard";
import OnboardingTour from "@/components/OnboardingTour";
import type { OnboardingState } from "@/lib/onboarding";

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
  | "gender"
  | "dob"
  | "marital_status"
  | "sort_seq"
>;

type SortMode = "book" | "name" | "oldest" | "youngest";
type GenderFilter = "all" | "M" | "F";
type AgeFilter = "all" | "under18" | "18-40" | "40-60" | "60+" | "unknown";
type StatusFilter = "all" | "living" | "deceased";
type MaritalFilter = "all" | "married" | "unmarried";

interface Filters {
  gender: GenderFilter;
  age: AgeFilter;
  city: string;
  gotra: string;
  status: StatusFilter;
  marital: MaritalFilter;
}

const DEFAULT_FILTERS: Filters = {
  gender: "all",
  age: "all",
  city: "",
  gotra: "",
  status: "all",
  marital: "all",
};

function parseAge(dob: string | null): number | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const birth = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function ageGroup(dob: string | null, isDeceased: boolean): AgeFilter {
  if (isDeceased) return "unknown";
  const age = parseAge(dob);
  if (age === null) return "unknown";
  if (age < 18) return "under18";
  if (age < 40) return "18-40";
  if (age < 60) return "40-60";
  return "60+";
}

function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.gender !== "all") n++;
  if (f.age !== "all") n++;
  if (f.city) n++;
  if (f.gotra) n++;
  if (f.status !== "all") n++;
  if (f.marital !== "all") n++;
  return n;
}

export default function DirectoryClient({
  members,
}: {
  members: DirectoryMember[];
}) {
  const router = useRouter();
  const { lang } = useLang();
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("book");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Pending filters: edits inside the sheet before "Apply"
  const [pending, setPending] = useState<Filters>(DEFAULT_FILTERS);

  const supabaseCl = useMemo(() => createClient(), []);
  const [userAvatar, setUserAvatar] = useState<{ photoUrl: string | null; initial: string }>({ photoUrl: null, initial: "?" });
  const [onbState, setOnbState] = useState<OnboardingState | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

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

  // Onboarding: single fetch shared by WelcomeCard + OnboardingTour
  useEffect(() => {
    let cancelled = false;
    async function loadOnboarding() {
      const { data, error } = await supabaseCl.rpc("get_onboarding_state");
      if (cancelled || error || !data) return;
      const s = data as OnboardingState;
      if (!s.found) return;
      setOnbState(s);
      if (s.show_tour) setTourOpen(true);
    }
    loadOnboarding();
    return () => { cancelled = true; };
  }, [supabaseCl]);

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

  // Filter + sort
  const filtered = useMemo(() => {
    let result = members;

    // -- Filters --
    if (filters.gender !== "all") {
      result = result.filter((m) => m.gender === filters.gender);
    }
    if (filters.age !== "all") {
      result = result.filter((m) => ageGroup(m.dob, m.is_deceased) === filters.age);
    }
    if (filters.city) {
      result = result.filter((m) => bi(m.city, m.city_en, lang) === filters.city);
    }
    if (filters.gotra) {
      result = result.filter((m) => bi(m.gotra, m.gotra_en, lang) === filters.gotra);
    }
    if (filters.status === "living") {
      result = result.filter((m) => !m.is_deceased);
    } else if (filters.status === "deceased") {
      result = result.filter((m) => m.is_deceased);
    }
    if (filters.marital === "married") {
      result = result.filter((m) => m.marital_status === "married");
    } else if (filters.marital === "unmarried") {
      result = result.filter((m) => m.marital_status === "unmarried");
    }

    // -- Search --
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

    // -- Sort --
    const sorted = [...result];
    if (sortMode === "book") {
      sorted.sort((a, b) => (a.sort_seq ?? Infinity) - (b.sort_seq ?? Infinity) || a.member_id.localeCompare(b.member_id));
    } else if (sortMode === "name") {
      sorted.sort((a, b) => {
        const nameA = (lang === "en" ? (a.full_name_en || a.full_name) : a.full_name) || "";
        const nameB = (lang === "en" ? (b.full_name_en || b.full_name) : b.full_name) || "";
        return nameA.localeCompare(nameB, lang === "en" ? "en" : "hi", { sensitivity: "base" });
      });
    } else {
      // oldest / youngest — deceased or missing dob sort LAST, secondary: book order
      const sign = sortMode === "oldest" ? 1 : -1;
      sorted.sort((a, b) => {
        const ageA = a.is_deceased ? null : parseAge(a.dob);
        const ageB = b.is_deceased ? null : parseAge(b.dob);
        if (ageA !== null && ageB !== null) return sign * (ageB - ageA); // higher age = older
        if (ageA !== null) return -1;
        if (ageB !== null) return 1;
        return (a.sort_seq ?? Infinity) - (b.sort_seq ?? Infinity);
      });
    }

    return sorted;
  }, [members, search, filters, sortMode, lang]);

  const filterCount = activeFilterCount(filters);

  const openSheet = useCallback(() => {
    setPending(filters);
    setSheetOpen(true);
  }, [filters]);

  const applyFilters = useCallback(() => {
    setFilters(pending);
    setSheetOpen(false);
  }, [pending]);

  const clearAll = useCallback(() => {
    setPending(DEFAULT_FILTERS);
  }, []);

  const removeFilter = useCallback((key: keyof Filters) => {
    setFilters((f) => ({ ...f, [key]: DEFAULT_FILTERS[key] }));
  }, []);

  // Dismiss filter sheet on Escape
  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setSheetOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  // Chip label helpers
  function chipLabel(key: keyof Filters, value: string): string {
    switch (key) {
      case "gender": return value === "M" ? t("gender_male", lang) : t("gender_female", lang);
      case "age": {
        const map: Record<string, string> = { under18: t("age_under_18", lang), "18-40": t("age_18_40", lang), "40-60": t("age_40_60", lang), "60+": t("age_60_plus", lang), unknown: t("age_unknown", lang) };
        return map[value] || value;
      }
      case "city": return value;
      case "gotra": return `${t("filter_gotra", lang)}: ${value}`;
      case "status": return value === "living" ? t("status_living", lang) : t("status_deceased", lang);
      case "marital": return value === "married" ? t("marital_married", lang) : t("marital_unmarried", lang);
      default: return value;
    }
  }

  // Sort option labels
  const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: "book", label: t("sort_book_order", lang) },
    { value: "name", label: t("sort_name_az", lang) },
    { value: "oldest", label: t("sort_oldest", lang) },
    { value: "youngest", label: t("sort_youngest", lang) },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--cream)] pb-20 md:ml-[240px] md:pb-8">
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b border-[var(--hairline)] px-4 pb-3 shadow-[var(--shadow-header)]"
        style={{ background: "linear-gradient(180deg, #33121a, var(--ink))", paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}
      >
        <div className="mx-auto flex max-w-lg md:max-w-2xl items-center justify-between">
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] overflow-hidden motion-safe:transition-opacity motion-safe:duration-[var(--dur-fast)] hover:opacity-80 md:hidden"
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

      <div className="mx-auto max-w-lg md:max-w-2xl px-4 pt-4">
        {/* Welcome card */}
        {onbState && <WelcomeCard state={onbState} />}

        {/* Celebrations */}
        <CelebrationsStrip />

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

        {/* Sort + Filter row */}
        <div className="mb-4 flex items-center gap-2">
          {/* Sort dropdown */}
          <div className="relative flex-1 min-w-0">
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label={t("sort_label", lang)}
              className="min-h-[44px] w-full appearance-none rounded-[var(--r-sm)] border border-[#ECE0C8] bg-[var(--raised)] px-3 pr-8 py-1.5 text-sm font-medium text-[var(--maroon)] cursor-pointer focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)]"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {/* Dropdown chevron */}
            <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Filters button */}
          <button
            onClick={openSheet}
            className="relative min-h-[44px] shrink-0 rounded-[var(--r-sm)] border border-[#ECE0C8] bg-[var(--raised)] px-4 py-1.5 text-sm font-medium text-[var(--maroon)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:border-[var(--gold)]"
            aria-label={t("filters_label", lang)}
          >
            <span className="flex items-center gap-1.5">
              {/* Funnel icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {t("filters_label", lang)}
            </span>
            {filterCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--maroon)] text-[11px] font-bold text-[var(--ivory)]">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active filter chips */}
        {filterCount > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(filters) as (keyof Filters)[]).map((key) => {
              const val = filters[key];
              if (val === "all" || val === "") return null;
              return (
                <button
                  key={key}
                  onClick={() => removeFilter(key)}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-[var(--gold)] bg-[rgba(201,150,46,0.08)] px-3 py-1 text-[13px] font-medium text-[var(--maroon-deep)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[rgba(201,150,46,0.18)]"
                >
                  {chipLabel(key, val)}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}

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
                            {t("status_deceased", lang)}
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

      {tourOpen && onbState && (
        <OnboardingTour state={onbState} onClose={() => setTourOpen(false)} />
      )}

      {/* ── Filter sheet ─────────────────────────────────────────────── */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center motion-safe:animate-[fadeIn_200ms_ease-out]"
          style={{ background: "rgba(30,8,12,0.55)" }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl sm:mx-4 bg-[var(--raised)] shadow-xl motion-safe:animate-[slideUp_250ms_ease-out] sm:animate-none"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t("filters_label", lang)}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between border-b border-[var(--border-card)] px-5 py-3.5">
              <h2 className="font-display text-base font-semibold text-[var(--maroon)]">
                {t("filters_label", lang)}
              </h2>
              <button
                onClick={clearAll}
                className="text-[13px] font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]"
              >
                {t("clear_all_filters", lang)}
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-5">
              {/* Gender */}
              <FilterSection label={t("filter_gender", lang)}>
                <PillGroup
                  options={[
                    { value: "all", label: t("filter_all", lang) },
                    { value: "M", label: t("gender_male", lang) },
                    { value: "F", label: t("gender_female", lang) },
                  ]}
                  selected={pending.gender}
                  onChange={(v) => setPending((p) => ({ ...p, gender: v as GenderFilter }))}
                />
              </FilterSection>

              {/* Age */}
              <FilterSection label={t("filter_age", lang)}>
                <PillGroup
                  options={[
                    { value: "all", label: t("filter_all", lang) },
                    { value: "under18", label: t("age_under_18", lang) },
                    { value: "18-40", label: t("age_18_40", lang) },
                    { value: "40-60", label: t("age_40_60", lang) },
                    { value: "60+", label: t("age_60_plus", lang) },
                    { value: "unknown", label: t("age_unknown", lang) },
                  ]}
                  selected={pending.age}
                  onChange={(v) => setPending((p) => ({ ...p, age: v as AgeFilter }))}
                />
              </FilterSection>

              {/* Status */}
              <FilterSection label={t("filter_status", lang)}>
                <PillGroup
                  options={[
                    { value: "all", label: t("filter_all", lang) },
                    { value: "living", label: t("status_living", lang) },
                    { value: "deceased", label: t("status_deceased", lang) },
                  ]}
                  selected={pending.status}
                  onChange={(v) => setPending((p) => ({ ...p, status: v as StatusFilter }))}
                />
              </FilterSection>

              {/* Marital */}
              <FilterSection label={t("filter_marital", lang)}>
                <PillGroup
                  options={[
                    { value: "all", label: t("filter_all", lang) },
                    { value: "married", label: t("marital_married", lang) },
                    { value: "unmarried", label: t("marital_unmarried", lang) },
                  ]}
                  selected={pending.marital}
                  onChange={(v) => setPending((p) => ({ ...p, marital: v as MaritalFilter }))}
                />
              </FilterSection>

              {/* City */}
              <FilterSection label={t("filter_city", lang)}>
                <select
                  value={pending.city}
                  onChange={(e) => setPending((p) => ({ ...p, city: e.target.value }))}
                  className="min-h-[44px] w-full appearance-none rounded-[var(--r-sm)] border border-[#ECE0C8] bg-white px-3 py-2 text-sm text-[var(--maroon-deep)] cursor-pointer focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                >
                  <option value="">{t("filter_all", lang)}</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FilterSection>

              {/* Gotra */}
              <FilterSection label={t("filter_gotra", lang)}>
                <select
                  value={pending.gotra}
                  onChange={(e) => setPending((p) => ({ ...p, gotra: e.target.value }))}
                  className="min-h-[44px] w-full appearance-none rounded-[var(--r-sm)] border border-[#ECE0C8] bg-white px-3 py-2 text-sm text-[var(--maroon-deep)] cursor-pointer focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
                >
                  <option value="">{t("filter_all", lang)}</option>
                  {gotras.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </FilterSection>
            </div>

            {/* Apply button */}
            <div className="px-5 pt-2">
              <button
                onClick={applyFilters}
                className="w-full min-h-[48px] rounded-lg bg-[var(--maroon)] py-3 text-base font-medium text-[var(--ivory)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--maroon-deep)]"
              >
                {t("apply_filters", lang)}
              </button>
            </div>
          </div>

          {/* Keyframe animations */}
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            @media (prefers-reduced-motion: reduce) {
              .motion-safe\\:animate-\\[fadeIn_200ms_ease-out\\],
              .motion-safe\\:animate-\\[slideUp_250ms_ease-out\\] { animation: none !important; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-[var(--gold-deep)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function PillGroup({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[36px] rounded-full px-3.5 py-1.5 text-[13px] font-medium motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
            selected === o.value
              ? "bg-[var(--maroon)] text-[var(--ivory)] shadow-[0_2px_8px_rgba(110,30,42,0.25)]"
              : "border border-[#ECE0C8] bg-white text-[var(--maroon)] hover:border-[var(--gold)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
