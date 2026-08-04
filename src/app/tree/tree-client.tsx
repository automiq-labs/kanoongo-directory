"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { memberDisplayName } from "@/lib/display-name";
import LanguageToggle from "@/app/language-toggle";
import BottomNav from "@/app/bottom-nav";
import { Crest } from "@/components/Crest";
import InitialsAvatar from "@/components/form/InitialsAvatar";
import { FadeIn } from "@/components/Motion";

// ── Types ──────────────────────────────────────────────────────────────────

interface FamilyLine {
  root_id: string;
  full_name: string;
  full_name_en: string | null;
  photo_url: string | null;
  is_deceased: boolean;
  branch_size: number;
  generations: number;
}

interface TreeMember {
  member_id: string;
  parent_id: string | null;
  full_name: string;
  full_name_en: string | null;
  photo_url: string | null;
  is_deceased: boolean;
  gender: string | null;
  marital_status: string | null;
  depth: number;
}

// ── Main tree page ─────────────────────────────────────────────────────────

export default function TreeClient() {
  const { lang } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const selectedLineId = searchParams.get("line");

  // ── LINE PICKER STATE ───────────────────────────────────────────────────

  const [lines, setLines] = useState<FamilyLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(true);
  const [showSmaller, setShowSmaller] = useState(false);

  // ── DRILL-DOWN STATE ────────────────────────────────────────────────────

  const [treeNodes, setTreeNodes] = useState<TreeMember[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Fetch family lines
  useEffect(() => {
    let cancelled = false;
    async function loadLines() {
      const { data, error } = await supabase.rpc("get_family_lines");
      if (error) console.error("get_family_lines error:", error);
      if (!cancelled) {
        setLines((data as FamilyLine[]) || []);
        setLinesLoading(false);
      }
    }
    loadLines();
    return () => { cancelled = true; };
  }, [supabase]);

  // When a line is selected, fetch the full tree once
  useEffect(() => {
    if (!selectedLineId) return;
    let cancelled = false;
    async function loadTree() {
      setTreeLoading(true);
      const { data, error } = await supabase.rpc("get_family_tree", { p_root_id: selectedLineId });
      if (error) console.error("get_family_tree error:", error);
      if (cancelled) return;
      const d = data as { found: boolean; nodes: TreeMember[] } | null;
      if (d?.found) {
        setTreeNodes(d.nodes);
        setFocusId(selectedLineId);
      }
      setTreeLoading(false);
    }
    loadTree();
    return () => { cancelled = true; };
  }, [selectedLineId, supabase]);

  // ── DERIVED: in-memory lookups ──────────────────────────────────────────

  const byId = useMemo(() => {
    const map = new Map<string, TreeMember>();
    for (const n of treeNodes) map.set(n.member_id, n);
    return map;
  }, [treeNodes]);

  const childrenOf = useMemo(() => {
    const map = new Map<string, TreeMember[]>();
    for (const n of treeNodes) {
      if (n.parent_id) {
        const arr = map.get(n.parent_id) || [];
        arr.push(n);
        map.set(n.parent_id, arr);
      }
    }
    return map;
  }, [treeNodes]);

  // Breadcrumb: walk parent_id from focusId up to root, then reverse
  const breadcrumb = useMemo(() => {
    if (!focusId) return [];
    const path: TreeMember[] = [];
    let current = byId.get(focusId);
    while (current) {
      path.push(current);
      if (!current.parent_id) break;
      current = byId.get(current.parent_id);
    }
    return path.reverse();
  }, [focusId, byId]);

  const focusPerson = focusId ? byId.get(focusId) : null;
  const focusChildren = focusId ? childrenOf.get(focusId) || [] : [];

  // ── NAVIGATION ──────────────────────────────────────────────────────────

  function selectLine(rootId: string) {
    router.push(`/tree?line=${rootId}`);
  }

  function goBack() {
    setTreeNodes([]);
    setFocusId(null);
    router.push("/tree");
  }

  function recenter(memberId: string) {
    setFocusId(memberId);
  }

  function handleChildTap(child: TreeMember) {
    const hasGrandchildren = (childrenOf.get(child.member_id) || []).length > 0;
    if (hasGrandchildren) {
      recenter(child.member_id);
    } else {
      router.push(`/family/${child.member_id}`);
    }
  }

  const mainLines = lines.filter((l) => l.branch_size >= 2);
  const smallLines = lines.filter((l) => l.branch_size === 1);

  // ── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-24 md:ml-[240px] md:pb-8">
      {/* Entrance animation */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .tree-fade { animation: fadeUp var(--dur) var(--ease-out) both; }
        }
      `}</style>

      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b border-[var(--hairline)] px-4 pb-3 shadow-[var(--shadow-header)]"
        style={{ background: "linear-gradient(180deg, #33121a, var(--ink))", paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}
      >
        <div className="mx-auto flex max-w-lg md:max-w-xl items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {selectedLineId ? (
              <button
                onClick={goBack}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--gold)] hover:bg-[var(--maroon-deep)]"
                aria-label={t("tree_all_lines", lang)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <div className="shrink-0">
                <Crest size={24} />
              </div>
            )}
            <h1 className="truncate font-display text-[16px] font-semibold text-[#F4E3C1]">
              {t("tree_title", lang)}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* ── LINE PICKER ──────────────────────────────────────────── */}
      {!selectedLineId && (
        <div className="mx-auto max-w-lg md:max-w-xl px-4 pt-4">
          <p className="mb-4 text-sm text-[var(--muted)]">
            {t("tree_pick_line", lang)}
          </p>

          {linesLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4">
                  <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--cream-panel)]" />
                  <div className="flex-1">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--cream-panel)]" />
                    <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-[var(--cream-panel)]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!linesLoading && (
            <div className="space-y-2">
              {mainLines.map((line, i) => {
                const lineName = memberDisplayName(line, lang);
                return (
                  <button
                    key={line.root_id}
                    onClick={() => selectLine(line.root_id)}
                    className="tree-fade flex w-full items-center gap-3 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-4 text-left shadow-card motion-safe:transition-[transform,box-shadow] motion-safe:duration-[var(--dur)] hover:-translate-y-[2px] hover:shadow-lift active:scale-[.98]"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <InitialsAvatar name={line.full_name} nameEn={line.full_name_en} photoUrl={line.photo_url} deceased={line.is_deceased} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className={`font-display text-base font-semibold ${line.is_deceased ? "text-[var(--muted)]" : "text-[var(--maroon-deep)]"}`}>
                        {lineName}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--muted)]">
                        {line.branch_size} {t("tree_members", lang)} · {line.generations} {t("tree_gen", lang)}
                      </p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-[var(--gold)] opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}

              {smallLines.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowSmaller((p) => !p)}
                    className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 motion-safe:transition-transform motion-safe:duration-[var(--dur)] ${showSmaller ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {t("tree_smaller", lang)} ({smallLines.length})
                  </button>
                  {showSmaller && smallLines.map((line) => {
                    const lineName = memberDisplayName(line, lang);
                    return (
                      <button
                        key={line.root_id}
                        onClick={() => selectLine(line.root_id)}
                        className="flex w-full items-center gap-3 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-3 text-left motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
                      >
                        <InitialsAvatar name={line.full_name} nameEn={line.full_name_en} photoUrl={line.photo_url} deceased={line.is_deceased} size="sm" />
                        <p className={`font-display text-sm font-semibold ${line.is_deceased ? "text-[var(--muted)]" : "text-[var(--maroon-deep)]"}`}>
                          {lineName}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FOCUS / RECENTER DRILL-DOWN ───────────────────────────── */}
      {selectedLineId && (
        <div className="mx-auto max-w-lg md:max-w-xl px-4 pt-4">
          {/* Loading */}
          {treeLoading && (
            <div className="space-y-4 py-8">
              <div className="mx-auto h-[88px] w-[88px] animate-pulse rounded-full bg-[var(--cream-panel)]" />
              <div className="mx-auto h-5 w-2/3 animate-pulse rounded bg-[var(--cream-panel)]" />
              <div className="mx-auto h-4 w-1/3 animate-pulse rounded bg-[var(--cream-panel)]" />
            </div>
          )}

          {!treeLoading && focusPerson && (
            <>
              {/* ── Breadcrumb ───────────────────────────────────── */}
              {breadcrumb.length > 1 && (
                <nav className="mb-4 flex items-center gap-1 overflow-x-auto text-[12px]">
                  {breadcrumb.map((crumb, i) => {
                    const crumbName = memberDisplayName(crumb, lang);
                    const isLast = i === breadcrumb.length - 1;

                    // On mobile, collapse middle crumbs if > 3
                    if (breadcrumb.length > 3 && i > 0 && i < breadcrumb.length - 2) {
                      if (i === 1) {
                        return (
                          <span key="ellipsis" className="flex items-center gap-1">
                            <span className="text-[var(--muted)]">…</span>
                            <span className="text-[var(--gold)] opacity-50">›</span>
                          </span>
                        );
                      }
                      return null;
                    }

                    return (
                      <span key={crumb.member_id} className="flex shrink-0 items-center gap-1">
                        {i > 0 && <span className="text-[var(--gold)] opacity-50">›</span>}
                        {isLast ? (
                          <span className="font-semibold text-[var(--maroon-deep)]">
                            {crumbName}
                          </span>
                        ) : (
                          <button
                            onClick={() => recenter(crumb.member_id)}
                            className="font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]"
                          >
                            {crumbName}
                          </button>
                        )}
                      </span>
                    );
                  })}
                </nav>
              )}

              {/* ── Focus person card ────────────────────────────── */}
              <FadeIn key={focusPerson.member_id}>
                <div className="flex flex-col items-center rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-6 shadow-card">
                  <InitialsAvatar
                    name={focusPerson.full_name}
                    nameEn={focusPerson.full_name_en}
                    photoUrl={focusPerson.photo_url}
                    deceased={focusPerson.is_deceased}
                    size="lg"
                  />
                  <h2 className={`mt-3 text-center font-display text-xl font-semibold ${focusPerson.is_deceased ? "text-[var(--muted)]" : "text-[var(--maroon-deep)]"}`}>
                    {memberDisplayName(focusPerson, lang)}
                  </h2>
                  {focusPerson.is_deceased && (
                    <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[var(--gold-deep)]">
                      In remembrance
                    </span>
                  )}
                  <Link
                    href={`/family/${focusPerson.member_id}`}
                    className="mt-3 flex items-center gap-1 text-sm font-medium text-[var(--gold-deep)] hover:text-[var(--maroon)]"
                  >
                    {lang === "en" ? "View full profile" : "पूरा प्रोफ़ाइल देखें"} →
                  </Link>
                </div>
              </FadeIn>

              {/* ── Children section ──────────────────────────────── */}
              <div className="mt-6">
                {focusChildren.length > 0 ? (
                  <>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {lang === "en" ? "Children" : "संतान"} ({focusChildren.length})
                    </h3>

                    {/* Gold vertical thread */}
                    <div className="relative">
                      <div
                        className="absolute left-[19px] top-0 bottom-0 w-[2px] opacity-40"
                        style={{ background: "linear-gradient(to bottom, var(--gold) 0%, var(--gold) 90%, transparent)" }}
                      />

                      <div className="space-y-0">
                        {focusChildren.map((child, i) => {
                          const childName = memberDisplayName(child, lang);
                          const grandchildCount = (childrenOf.get(child.member_id) || []).length;
                          const hasMore = grandchildCount > 0;

                          return (
                            <FadeIn key={child.member_id} delay={Math.min(i * 0.04, 0.2)}>
                              <button
                                onClick={() => handleChildTap(child)}
                                className="relative flex w-full items-center gap-3 rounded-[var(--r)] px-1 py-3 text-left motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"
                              >
                                {/* Horizontal connector */}
                                <div className="absolute left-[19px] top-1/2 h-[2px] w-3 -translate-y-1/2 bg-[var(--gold)] opacity-40" />

                                <div className="relative z-[1] ml-[28px]">
                                  <InitialsAvatar
                                    name={child.full_name}
                                    nameEn={child.full_name_en}
                                    photoUrl={child.photo_url}
                                    deceased={child.is_deceased}
                                    size="sm"
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className={`font-display text-[15px] font-semibold ${child.is_deceased ? "text-[var(--muted)]" : "text-[var(--maroon-deep)]"}`}>
                                    {childName}
                                  </p>
                                  {hasMore && (
                                    <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-[var(--gold-deep)]">
                                      {grandchildCount} {t("tree_children_count", lang)}
                                    </span>
                                  )}
                                </div>

                                {/* Chevron for drill-down, arrow for leaf → card */}
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4 shrink-0 text-[var(--gold)] opacity-60"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </FadeIn>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[var(--r)] border border-[var(--hairline)] bg-[var(--raised)] px-4 py-6 text-center">
                    <p className="text-sm text-[var(--muted)]">
                      {lang === "en" ? "No recorded children" : "कोई दर्ज संतान नहीं"}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
