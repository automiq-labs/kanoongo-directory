"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";
import LanguageToggle from "@/app/language-toggle";
import BottomNav from "@/app/bottom-nav";
import {
  HISTORY_PHOTO_URL,
  HISTORY_SOURCE_CREDIT,
  HISTORY_EDITORIAL,
  HISTORY_PHOTO,
  LINEAGE_SPINE,
  LINEAGE_GEN14,
  LINEAGE_TREE,
  LINEAGE_HEADING,
  type LineageNode,
} from "@/lib/history-content";

/* ─── Recursive tree node ────────────────────────────────────────────── */

function TreeNode({ node, depth }: { node: LineageNode; depth: number }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={`flex w-full min-h-[40px] items-center gap-2 rounded-[var(--r-sm)] px-2 py-1.5 text-left ${
          hasChildren ? "hover:bg-[var(--cream-panel)]" : "cursor-default"
        }`}
        style={{ paddingLeft: `${Math.min(depth * 14, 70) + 8}px` }}
      >
        {/* Chevron */}
        {hasChildren ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3.5 w-3.5 shrink-0 text-[var(--gold-deep)] motion-safe:transition-transform motion-safe:duration-[var(--dur-fast)] ${open ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <span className="inline-block h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--gold)] opacity-60" />
        )}
        {/* Name */}
        <span className="text-sm font-medium text-[var(--maroon-deep)]">{node.name}</span>
        {/* Page chip */}
        {node.page && (
          <span className="ml-1.5 shrink-0 rounded-[var(--r-pill)] bg-[rgba(201,150,46,0.12)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--gold-deep)]">
            पृष्ठ {node.page}
          </span>
        )}
        {/* Note */}
        {node.note && (
          <span className="ml-1.5 truncate text-[11px] italic text-[var(--muted)]">{node.note}</span>
        )}
      </button>
      {/* Children */}
      {open && hasChildren && (
        <div className="relative">
          {/* Guide line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-[var(--gold)]/25"
            style={{ left: `${Math.min((depth + 1) * 14, 70) + 12}px` }}
          />
          {node.children!.map((child, i) => (
            <TreeNode key={`${child.name}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function HistoryPage() {
  const { lang } = useLang();
  const router = useRouter();

  const isPlaceholderPhoto = !HISTORY_PHOTO_URL || HISTORY_PHOTO_URL.includes("REPLACE_WITH");

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-24 md:ml-[240px] md:pb-8">
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b border-[var(--hairline)] px-5 pb-3 shadow-[var(--shadow-header)]"
        style={{
          background: "linear-gradient(180deg, #33121a, var(--ink))",
          paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="mx-auto flex max-w-lg md:max-w-2xl items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--gold)] hover:bg-[var(--maroon-deep)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 font-display text-lg font-semibold text-[#F4E3C1]">
            📜 {t("hist_title", lang)}
          </h1>
          <LanguageToggle />
        </div>
      </header>

      <div className="mx-auto max-w-lg md:max-w-2xl px-5 pt-5">

        {/* ══════ A — Photo section ════════════════════════════════ */}
        <section className="mb-8">
          <h2 className="mb-1 font-display text-lg font-semibold text-[var(--maroon)]">
            {t("hist_photo_section", lang)}
          </h2>
          <p className="mb-4 font-display text-base text-[var(--maroon-deep)]">{HISTORY_PHOTO.title}</p>

          {isPlaceholderPhoto ? (
            <div className="flex h-48 items-center justify-center rounded-[var(--r-lg)] border-2 border-dashed border-[var(--muted)]/30 bg-[var(--cream-panel)]">
              <p className="text-sm text-[var(--muted)]">
                {lang === "hi" ? "फ़ोटो जल्द ही जोड़ी जाएगी" : "Photo coming soon"}
              </p>
            </div>
          ) : (
            <img
              src={HISTORY_PHOTO_URL}
              alt={HISTORY_PHOTO.title}
              className="w-full rounded-[var(--r-lg)] border border-[#EFE4CD] object-contain shadow-card"
            />
          )}

          <div className="mt-4 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
            <p className="mb-3 text-sm text-[var(--text-body)]">{HISTORY_PHOTO.caption_intro}</p>
            {HISTORY_PHOTO.rows.map((row, i) => (
              <p key={i} className="mb-1.5 text-sm text-[var(--text-body)]">
                <span className="font-semibold text-[var(--maroon-deep)]">{row.label}:</span> {row.text}
              </p>
            ))}
            {HISTORY_PHOTO.note && (
              <p className="mt-3 text-[12px] italic text-[var(--muted)]">{HISTORY_PHOTO.note}</p>
            )}
          </div>
        </section>

        {/* ══════ B — Editorial section ════════════════════════════ */}
        <section className="mb-8">
          <h2 className="mb-4 font-display text-lg font-semibold text-[var(--maroon)]">
            {HISTORY_EDITORIAL.heading}
          </h2>
          <div className="rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-5 shadow-card">
            {HISTORY_EDITORIAL.body.split("\n\n").map((para, i) => (
              <p key={i} className="mb-3 text-sm leading-relaxed text-[var(--text-body)] last:mb-0">
                {para}
              </p>
            ))}
            <p className="mt-4 text-right font-display text-sm italic text-[var(--gold-deep)]">
              {HISTORY_EDITORIAL.signature}
            </p>
          </div>
        </section>

        {/* ══════ C — Lineage section ═════════════════════════════ */}
        <section className="mb-8">
          <h2 className="mb-1 font-display text-lg font-semibold text-[var(--maroon)]">
            {LINEAGE_HEADING}
          </h2>
          <p className="mb-4 text-xs text-[var(--muted)]">{t("hist_lineage_expand_hint", lang)}</p>

          {/* Spine: Gen -5 → 13 */}
          <div className="mb-5 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
            <div className="relative">
              {/* Vertical thread */}
              <div className="absolute left-[10px] top-2 bottom-2 w-px bg-[var(--gold)]/30" />
              <div className="space-y-3">
                {LINEAGE_SPINE.map((node) => (
                  <div key={`s-${node.gen}`} className="relative flex items-start gap-3 pl-6">
                    {/* Diamond node */}
                    <div className="absolute left-[6px] top-[7px] h-[9px] w-[9px] rotate-45 border-[1.5px] border-[var(--gold)] bg-[var(--raised)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded-[var(--r-pill)] bg-[rgba(201,150,46,0.12)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold-deep)]">
                          पीढ़ी {node.gen}
                        </span>
                        <span className="font-display text-sm font-semibold text-[var(--maroon-deep)]">{node.name}</span>
                      </div>
                      {node.note && <p className="mt-0.5 text-[11px] italic text-[var(--muted)]">{node.note}</p>}
                      {node.children_inline && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{node.children_inline}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Generation 14 — branch heads */}
          <div className="mb-5 rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--gold-deep)]">पीढ़ी 14 — चार शाखाएं</p>
            <div className="grid grid-cols-2 gap-2">
              {LINEAGE_GEN14.map((node, i) => (
                <div key={i} className="rounded-[var(--r-sm)] border border-[#EFE4CD] bg-[var(--cream)] p-2.5">
                  <p className="font-display text-sm font-semibold text-[var(--maroon-deep)]">{node.name}</p>
                  {node.note && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{node.note}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Collapsible tree: Gen 15+ */}
          <div className="rounded-[var(--r)] border border-[#EFE4CD] bg-[var(--raised)] p-4 shadow-card">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--gold-deep)]">पीढ़ी 15 और आगे</p>
            <div className="space-y-1">
              {LINEAGE_TREE.map((node, i) => (
                <TreeNode key={`t-${i}`} node={node} depth={0} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════ D — Source ══════════════════════════════════════ */}
        <footer className="mb-6 text-center">
          <p className="text-xs text-[var(--muted)]">
            {t("hist_source", lang)}: {HISTORY_SOURCE_CREDIT}
          </p>
        </footer>
      </div>

      <BottomNav />
    </div>
  );
}
