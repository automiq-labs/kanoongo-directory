"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import LanguageToggle from "@/app/language-toggle";
import BottomNav from "@/app/bottom-nav";
import { Crest } from "@/components/Crest";

interface TreeSpouse {
  full_name: string;
  full_name_en: string | null;
  date_of_death: string | null;
}

interface TreeNode {
  member_id: string;
  full_name: string;
  full_name_en: string | null;
  is_deceased: boolean;
  spouses: TreeSpouse[];
  childCount: number;
}

// ── Animated collapse wrapper ───────────────────────────────────────────────

function AnimatedChildren({
  expanded,
  children,
}: {
  expanded: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (expanded) {
      setVisible(true);
      // Measure after render
      requestAnimationFrame(() => {
        if (ref.current) setHeight(ref.current.scrollHeight);
      });
    } else {
      // Collapse: set explicit height first, then 0
      if (ref.current) setHeight(ref.current.scrollHeight);
      requestAnimationFrame(() => setHeight(0));
    }
  }, [expanded]);

  function handleTransitionEnd() {
    if (expanded) {
      setHeight("auto"); // allow dynamic content after open
    } else {
      setVisible(false);
    }
  }

  if (!visible && !expanded) return null;

  return (
    <div
      ref={ref}
      style={{
        height: height === "auto" ? "auto" : `${height}px`,
        overflow: height === "auto" ? "visible" : "hidden",
        transition: "height var(--dur) var(--ease-out)",
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {children}
    </div>
  );
}

// ── Recursive tree row ──────────────────────────────────────────────────────

const INDENT_PX = 16; // compact indent to prevent overflow on narrow screens
const MAX_INDENT_DEPTH = 8; // cap indentation beyond this

function TreeRow({
  node,
  depth,
  isRoot = false,
}: {
  node: TreeNode;
  depth: number;
  isRoot?: boolean;
}) {
  const { lang } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  const hasChildren = node.childCount > 0;

  const fetchChildren = useCallback(async () => {
    if (children) return; // already loaded
    setLoading(true);
    const supabase = createClient();

    // Fetch children members + their spouses + their child counts in parallel
    const { data: kids } = await supabase
      .from("members")
      .select("member_id, full_name, full_name_en, is_deceased")
      .eq("father_member_id", node.member_id)
      .order("full_name");

    const kidIds = (kids || []).map((k) => k.member_id);

    const [spouseResult, countResult] = await Promise.all([
      supabase
        .from("spouses")
        .select("member_id, full_name, full_name_en, date_of_death")
        .in("member_id", kidIds),
      supabase
        .from("members")
        .select("father_member_id")
        .in("father_member_id", kidIds),
    ]);

    const spouseMap: Record<string, TreeSpouse[]> = {};
    for (const s of spouseResult.data || []) {
      if (!spouseMap[s.member_id]) spouseMap[s.member_id] = [];
      spouseMap[s.member_id].push(s as TreeSpouse);
    }

    const countMap: Record<string, number> = {};
    for (const row of (countResult.data || []) as { father_member_id: string }[]) {
      countMap[row.father_member_id] = (countMap[row.father_member_id] || 0) + 1;
    }

    const nodes: TreeNode[] = (kids || []).map((k) => ({
      ...k,
      spouses: spouseMap[k.member_id] || [],
      childCount: countMap[k.member_id] || 0,
    }));

    setChildren(nodes);
    setLoading(false);
  }, [node.member_id, children]);

  function handleToggle() {
    if (!hasChildren) return;
    if (!expanded) fetchChildren();
    setExpanded((prev) => !prev);
  }

  const name = bi(node.full_name, node.full_name_en, lang);
  const spouseName =
    node.spouses.length > 0
      ? bi(node.spouses[0].full_name, node.spouses[0].full_name_en, lang)
      : null;
  const spouseDeceased = node.spouses.length > 0 && !!node.spouses[0].date_of_death;

  return (
    <div>
      {/* This row */}
      <div
        className={`flex items-center gap-2.5 rounded-[var(--r)] py-3 ${isRoot ? "px-1" : "px-2 motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)]"}`}
        style={{ paddingLeft: isRoot ? undefined : `${Math.min(depth, MAX_INDENT_DEPTH) * INDENT_PX}px` }}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--gold)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream-panel)] active:bg-[var(--cream-panel)]"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 motion-safe:transition-transform motion-safe:duration-[var(--dur)] ${
                expanded ? "rotate-90" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <span className="h-[5px] w-[5px] rounded-full bg-[var(--gold)] opacity-40" />
          </span>
        )}

        {/* Name + spouse */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <Link
              href={`/family/${node.member_id}`}
              className={`font-display font-semibold hover:text-[var(--maroon)] ${
                isRoot ? "text-[17px]" : "text-[15px]"
              } ${node.is_deceased ? "text-[var(--muted)]" : "text-[var(--maroon-deep)]"}`}
            >
              {name}
            </Link>
            {spouseName && (
              <span className="flex items-center gap-1 text-[13px] text-[var(--muted)]">
                <span className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--gold)] opacity-80" />
                {t("tree_with", lang)}{" "}
                <span className={spouseDeceased ? "text-[var(--muted)]" : "text-[var(--gold-deep)]"}>
                  {spouseName}
                </span>
              </span>
            )}
          </div>

          {/* Child count pill */}
          {hasChildren && !expanded && (
            <button
              onClick={handleToggle}
              className="mt-1 inline-flex items-center gap-1 rounded-full border border-[var(--gold)]/20 bg-[var(--cream-panel)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--gold-deep)] motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] hover:bg-[var(--cream)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {node.childCount} {t("tree_children_count", lang)}
            </button>
          )}
        </div>

        {/* Navigate chevron for root nodes */}
        {isRoot && (
          <Link href={`/family/${node.member_id}`} className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--gold)] opacity-60">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {/* Children (expanded) */}
      {hasChildren && (
        <AnimatedChildren expanded={expanded}>
          <div className="relative" style={{ marginLeft: `${Math.min(depth, MAX_INDENT_DEPTH) * INDENT_PX + 10}px` }}>
            {/* Gold vertical spine */}
            <div className="absolute left-[3px] top-0 bottom-3 w-[2px] bg-[var(--gold)] opacity-50" />

            {loading && !children && (
              <p
                className="py-3 text-sm text-[var(--muted)]"
                style={{ paddingLeft: "22px" }}
              >
                {t("tree_loading", lang)}
              </p>
            )}

            {children?.map((child) => (
              <div key={child.member_id} className="relative">
                {/* Horizontal connector joint */}
                <div
                  className="absolute left-[3px] top-[22px] h-[2px] w-3 bg-[var(--gold)] opacity-50"
                />
                <div style={{ paddingLeft: "4px" }}>
                  <TreeRow node={child} depth={0} />
                </div>
              </div>
            ))}
          </div>
        </AnimatedChildren>
      )}
    </div>
  );
}

// ── Main tree page ──────────────────────────────────────────────────────────

export default function TreeClient({ roots }: { roots: TreeNode[] }) {
  const { lang } = useLang();

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
        <div className="mx-auto flex max-w-lg md:max-w-2xl items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="shrink-0">
              <Crest size={24} />
            </div>
            <h1 className="truncate font-display text-[16px] font-semibold text-[#F4E3C1]">
              {t("tree_title", lang)}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <div className="mx-auto max-w-lg md:max-w-2xl px-4 pt-4">
        <div className="space-y-3">
          {roots.map((root, i) => (
            <div
              key={root.member_id}
              className="tree-fade rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] px-3 py-1 shadow-card"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <TreeRow node={root} depth={0} isRoot />
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
