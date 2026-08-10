"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { t, type Lang } from "@/lib/translations";
import { bi } from "@/lib/bilingual";
import { memberDisplayName, spouseDisplayName } from "@/lib/display-name";
import { RELATION_OPTIONS, RELATION_SORT_ORDER } from "@/lib/form-options";
import {
  HISTORY_EDITORIAL,
  HISTORY_PHOTO,
  HISTORY_PHOTO_URL,
  HISTORY_SOURCE_CREDIT,
  LINEAGE_HEADING,
} from "@/lib/history-content";
import {
  buildBook,
  buildLineageOutline,
  fetchDirectoryData,
  type BookPage,
  type DirectoryData,
  type MarriedDaughterRow,
  type MemberRow,
  type SpouseRelativeRow,
} from "@/lib/directory-book";

/**
 * Print rendering of the register.
 *
 * The page furniture is matched to the 2020 printed pages (036/037/038):
 * a four-column label/value/label/value grid with right-aligned labels, section
 * headings as underlined text inside the table rather than banners, the
 * numbering box as the table's own top-left cell, a bordered photo grid with
 * captions inside it, and fixed-slot ससुराल blocks in two columns.
 *
 * Two deliberate departures from the originals:
 *   * the register id is carried in the numbering box (2020's numbers are not
 *     recoverable, and page numbers shift as men marry),
 *   * source typos are not reproduced — "ससुराल की तरफ का विवरण" with का, and
 *     HINDI on every page (038 reads "HIDNI").
 */

/* ─── Helpers ──────────────────────────────────────────────────────────── */

const NBSP = " ";

/** dates are TEXT and ISO when present; anything else prints as stored. */
function fmtDate(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

function joinParts(parts: (string | null | undefined)[]): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
}

function relationLabel(r: SpouseRelativeRow, lang: Lang): string {
  const custom = bi(r.relation_label, r.relation_label_en, lang);
  if (custom) return custom;
  const opt = RELATION_OPTIONS.find((o) => o.code === r.relation_code);
  return opt ? (lang === "en" ? opt.en : opt.hi) : r.relation_code;
}

type Pair = [label: string, value: string];

/**
 * The register's core geometry: two independent label/value stacks side by
 * side. They are NOT paired — on page 036 the left stack runs out after four
 * rows while the right continues to six, leaving the left cells blank.
 *
 * Both stacks are fixed-length per section (see MemberSheet): a slot with no
 * data still prints its label and an empty value, because the register is a
 * form and its symmetry depends on every page having the same rows.
 */
function PairRows({ left, right }: { left: Pair[]; right: Pair[] }) {
  const rows = Math.max(left.length, right.length);
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          <td className="lbl">{left[i]?.[0] ?? NBSP}</td>
          <td className="val">{left[i]?.[1] || NBSP}</td>
          <td className="lbl">{right[i]?.[0] ?? NBSP}</td>
          <td className="val">{right[i]?.[1] || NBSP}</td>
        </tr>
      ))}
    </>
  );
}

/**
 * Section heading: a fixed triple, never anything else.
 *
 *   numbering (col 1) │ section title (cols 2–3) │ blank note cell (col 4)
 *
 * Both of its internal dividers land on skeleton dividers (20% and 68%), so a
 * heading row never introduces an x-position the body rows do not already have.
 */
function HeadingRow({ title, numbering }: { title: string; numbering?: React.ReactNode }) {
  return (
    <tr>
      <td className="numcell">{numbering ?? NBSP}</td>
      <td className="sec-cell" colSpan={2}><span className="sec-h">{title}</span></td>
      {/* The originals carry a production note here (COMP PHOT COMP …).
          Ours stays empty by ruling, but the cell is still rendered — the
          geometry depends on it. */}
      <td className="note-cell">{NBSP}</td>
    </tr>
  );
}

function SpacerRow() {
  return <tr className="bk-spacer"><td colSpan={4}>{NBSP}</td></tr>;
}

/**
 * The one skeleton. Every section of every entry in both editions uses these
 * four widths, and .bk-grid is `table-layout: fixed`, so the dividers stack in
 * the same x-position on every box on every page instead of being re-derived
 * from each table's own content.
 *
 * Book proportions: label columns narrow and equal, value columns wide, the
 * left value column narrower than the right.
 *
 * Stated as absolute lengths off --page-w (the A4 content width in mm) rather
 * than as percentages, so a column width never depends on what any ancestor
 * thinks its own width is. 20/28/20/32 of 186mm puts the three dividers at
 * 37.2mm / 89.28mm / 126.48mm on every box of every page.
 */
const COL_FRACTIONS = [0.2, 0.28, 0.2, 0.32];

function Cols() {
  return (
    <colgroup>
      {COL_FRACTIONS.map((f, i) => (
        <col key={i} style={{ width: `calc(var(--page-w, 186mm) * ${f})` }} />
      ))}
    </colgroup>
  );
}

/* ─── Page furniture ───────────────────────────────────────────────────── */

function Header({ lang, year }: { lang: Lang; year: number }) {
  return <header className="bk-head">{t("book_title", lang)} {year}</header>;
}

function Footer({ lang, stamp }: { lang: Lang; stamp: string }) {
  return (
    <footer className="bk-foot">
      <p className="bk-foot-line">{t("footer_attribution", lang)}</p>
      <p className="bk-foot-date">{t("book_date_stamp", lang)}: {stamp}</p>
    </footer>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return <div className="sheet">{children}</div>;
}

/** Photo grid: one bordered box, equal cells, captions in a row inside it. */
function PhotoGrid({
  frames,
  lang,
}: {
  frames: { key: string; url: string | null; caption: string }[];
  lang: Lang;
}) {
  if (frames.length === 0) return null;
  return (
    <table className="photos">
      <tbody>
        <tr>
          {frames.map((f) => (
            <td key={f.key} className="ph-cell">
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- print rendering
                <img src={f.url} alt="" className="ph-img" />
              ) : (
                <span className="ph-empty">{t("book_photo_placeholder", lang)}</span>
              )}
            </td>
          ))}
        </tr>
        <tr>
          {frames.map((f) => (
            <td key={f.key} className="ph-cap">{f.caption || NBSP}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/* ─── Married daughters ────────────────────────────────────────────────── */

function DaughterBlock({
  entry,
  index,
  lang,
}: {
  entry: { member: MemberRow; detail: MarriedDaughterRow | null };
  index: number;
  lang: Lang;
}) {
  const { member, detail } = entry;
  const name =
    memberDisplayName(member, lang) ||
    bi(detail?.full_name ?? null, detail?.full_name_en ?? null, lang) ||
    "";

  const left: Pair[] = [
    [`${index} ${t("book_lbl_name", lang)}`, name],
    [t("label_husband", lang), bi(detail?.husband_name ?? null, detail?.husband_name_en ?? null, lang) || ""],
    [t("label_sasur", lang), bi(detail?.sasur_name ?? null, detail?.sasur_name_en ?? null, lang) || ""],
    [t("book_lbl_postal", lang), joinParts([
      bi(detail?.addr ?? null, detail?.addr_en ?? null, lang),
      bi(detail?.city ?? null, detail?.city_en ?? null, lang),
    ])],
  ];
  const right: Pair[] = [
    [t("book_lbl_marriage_date", lang), fmtDate(detail?.dom)],
    [t("label_education", lang), bi(detail?.education ?? null, detail?.education_en ?? null, lang) || ""],
    [t("book_lbl_work", lang), bi(detail?.occupation ?? null, detail?.occupation_en ?? null, lang) || ""],
    [t("book_lbl_mobile_email", lang), joinParts([
      detail?.mobile, detail?.husband_mobile, detail?.sasur_mobile, detail?.email,
    ])],
    [t("label_children_note", lang), bi(detail?.children_note ?? null, detail?.children_note_en ?? null, lang) || ""],
  ];

  return <PairRows left={left} right={right} />;
}

/* ─── Member page ──────────────────────────────────────────────────────── */

function MemberSheet({
  page,
  lang,
  year,
  stamp,
  fatherName,
}: {
  page: BookPage;
  lang: Lang;
  year: number;
  stamp: string;
  fatherName: string;
}) {
  const m = page.member;
  const s = page.spouse;
  const name = memberDisplayName(m, lang) || "";
  const address = joinParts([
    bi(m.addr_line1, m.addr_line1_en, lang),
    bi(m.addr_line2, m.addr_line2_en, lang),
    bi(m.city, m.city_en, lang),
    bi(m.state, m.state_en, lang),
    m.pincode,
    bi(m.country, m.country_en, lang),
  ]);

  // Blank labelled rows are printed on purpose — the register is a form, and
  // these fill themselves in if the columns are ever added. The stack length is
  // fixed: no row is added or dropped because a particular man has or lacks a
  // value, otherwise the rows stop lining up from one page to the next.
  const personalLeft: Pair[] = [
    [t("book_lbl_name", lang), name],
    [t("label_father_name", lang), fatherName],
    [t("label_occupation", lang), bi(m.occupation, m.occupation_en, lang) || ""],
    [t("book_lbl_office_addr", lang), ""],           // no column
    // Printed for everyone, blank for the living — as the wife block already
    // does. Previously this row appeared only for the 20 dated deceased, which
    // made the personal block five rows tall on some entries and four on others.
    [t("book_lbl_death_date", lang), m.is_deceased ? fmtDate(m.date_of_death) : ""],
  ];
  const personalRight: Pair[] = [
    [t("book_lbl_dob_main", lang), fmtDate(m.dob)],
    [t("book_lbl_dob_office", lang), ""],            // no column
    [t("label_education", lang), bi(m.education, m.education_en, lang) || ""],
    [t("book_lbl_home_addr", lang), address],
    [t("book_lbl_phone_home", lang), ""],            // no column
    [t("book_lbl_mobile_email", lang), joinParts([m.mobile_1, m.mobile_2, m.email])],
  ];

  const wifeLeft: Pair[] = [
    [t("book_lbl_name", lang), s ? spouseDisplayName(s, lang) || "" : ""],
    [t("book_lbl_dob_main", lang), fmtDate(s?.dob)],
    [t("book_lbl_work", lang), ""],                  // no column on spouses
    [t("book_lbl_marriage_date", lang), fmtDate(s?.date_of_marriage)],
    [t("book_lbl_death_date", lang), fmtDate(s?.date_of_death)],
  ];
  const wifeRight: Pair[] = [
    [t("label_father_name", lang), bi(s?.father_name ?? null, s?.father_name_en ?? null, lang) || ""],
    [t("book_caste_gotra", lang), bi(s?.birth_gotra ?? null, s?.birth_gotra_en ?? null, lang) || ""],
    [t("label_education", lang), bi(s?.education ?? null, s?.education_en ?? null, lang) || ""],
    [t("book_lbl_mobile_email", lang), joinParts([s?.mobile, s?.email])],
  ];

  // ससुराल: fixed slots, two per row, empty ones printed. Slot count grows in
  // pairs so nobody is ever dropped (two members exceed four relatives).
  const rels = useMemo(
    () =>
      page.relatives
        .slice()
        .sort(
          (a, b) =>
            (RELATION_SORT_ORDER[a.relation_code] ?? 50) - (RELATION_SORT_ORDER[b.relation_code] ?? 50) ||
            (a.sort_seq ?? Infinity) - (b.sort_seq ?? Infinity) ||
            a.relative_id.localeCompare(b.relative_id),
        ),
    [page.relatives],
  );
  const slotCount = Math.max(2, rels.length + (rels.length % 2));
  const slotPairs: number[][] = [];
  for (let i = 0; i < slotCount; i += 2) slotPairs.push([i, i + 1]);

  function slotLabel(i: number): string {
    return i === 0 ? t("book_lbl_sasur_slot", lang) : t("book_slot_n", lang).replace("{n}", String(i));
  }
  function slotRows(i: number): Pair[] {
    const r = rels[i];
    const nameCell = r
      ? `(${relationLabel(r, lang)})${bi(r.full_name, r.full_name_en, lang) || ""}`
      : "";
    return [
      [slotLabel(i), nameCell],
      [t("book_lbl_postal", lang), r ? joinParts([bi(r.addr, r.addr_en, lang), bi(r.city, r.city_en, lang)]) : ""],
      [t("book_lbl_mobile_email", lang), r?.mobile || ""],
    ];
  }

  return (
    <>
      <Sheet>
        <Header lang={lang} year={year} />

        <PhotoGrid
          lang={lang}
          frames={[
            { key: "m", url: m.photo_url, caption: name },
            ...(s ? [{ key: "s", url: s.photo_url, caption: spouseDisplayName(s, lang) || "" }] : []),
            ...page.unmarriedChildren.map((c) => ({
              key: c.key,
              url: c.photo_url,
              caption: bi(c.full_name, c.full_name_en, lang) || "",
            })),
          ]}
        />

        {/* Every section box lives in this block so each table's containing
            block is the same element and the same width. Tables laid out as
            flex items of .sheet shrank to their own content, which is why the
            children and ससुराल boxes came out narrower than the main one. */}
        <div className="bk-grid-stack">
          {/* Personal + wife share one bordered table, as in the register */}
          <table className="bk-grid">
            <Cols />
            <tbody>
              <HeadingRow
                title={t("book_sec_personal", lang)}
                numbering={
                  <span className="numbox">
                    <span className="numbox-n">{String(page.pageNumber).padStart(3, "0")}</span>{" "}
                    <span className="numbox-id">{page.registerId}</span>{" "}
                    <span className="numbox-lang">{lang === "en" ? "ENGLISH" : "HINDI"}</span>
                  </span>
                }
              />
              <PairRows left={personalLeft} right={personalRight} />
              <HeadingRow title={t("book_sec_wife", lang)} />
              <PairRows left={wifeLeft} right={wifeRight} />
            </tbody>
          </table>

          {/* Children — one 3-row block each, numbered; heading always printed */}
          {page.unmarriedChildren.length > 0 && (
            <table className="bk-grid bk-block">
              <Cols />
              <tbody>
                <HeadingRow title={t("book_sec_children", lang)} />
                {page.unmarriedChildren.map((c, i) => (
                  <Fragment key={c.key}>
                    {i > 0 && <SpacerRow />}
                    <PairRows
                      left={[
                        [`${i + 1} ${t("book_lbl_name", lang)}`, bi(c.full_name, c.full_name_en, lang) || ""],
                        [t("label_education", lang), bi(c.education, c.education_en, lang) || ""],
                      ]}
                      right={[
                        [t("book_lbl_dob_child", lang), fmtDate(c.dob)],
                        [t("book_lbl_mobile_email", lang), joinParts([c.mobile, c.email])],
                        [t("book_lbl_work", lang), bi(c.occupation, c.occupation_en, lang) || ""],
                      ]}
                    />
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}

          {/* ससुराल — fixed slots, two per row */}
          <table className="bk-grid bk-block">
            <Cols />
            <tbody>
              <HeadingRow title={t("book_sec_sasural", lang)} />
              {slotPairs.map(([a, b], i) => (
                <Fragment key={i}>
                  {i > 0 && <SpacerRow />}
                  <PairRows left={slotRows(a)} right={slotRows(b)} />
                </Fragment>
              ))}
            </tbody>
          </table>

          {page.daughters.length > 0 && (
            <table className="bk-grid bk-block">
              <Cols />
              <tbody>
                <HeadingRow title={t("book_sec_daughters", lang)} />
                {page.daughters.map((d, i) => (
                  <Fragment key={d.member.member_id}>
                    {i > 0 && <SpacerRow />}
                    <DaughterBlock entry={d} index={i + 1} lang={lang} />
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Footer lang={lang} stamp={stamp} />
      </Sheet>

      {/* Continuation sheets — same register id, marked (क्रमशः) */}
      {page.daughterOverflow.map((slice, si) => (
        <Sheet key={`cont-${si}`}>
          <Header lang={lang} year={year} />
          <div className="bk-grid-stack">
            <table className="bk-grid">
              <Cols />
              <tbody>
                <HeadingRow
                  title={`${t("book_sec_daughters", lang)} ${t("book_continued", lang)}`}
                  numbering={
                    <span className="numbox">
                      <span className="numbox-n">{String(page.pageNumber).padStart(3, "0")}</span>{" "}
                      <span className="numbox-id">{page.registerId}</span>{" "}
                      <span className="numbox-lang">{lang === "en" ? "ENGLISH" : "HINDI"}</span>
                    </span>
                  }
                />
                {slice.map((d, i) => (
                  <Fragment key={d.member.member_id}>
                    {i > 0 && <SpacerRow />}
                    <DaughterBlock
                      entry={d}
                      index={page.daughters.length + si * slice.length + i + 1}
                      lang={lang}
                    />
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Footer lang={lang} stamp={stamp} />
        </Sheet>
      ))}
    </>
  );
}

/* ─── Front matter ─────────────────────────────────────────────────────── */

function FrontMatter({
  lang, year, pageCount, stamp,
}: { lang: Lang; year: number; pageCount: number; stamp: string }) {
  const outline = useMemo(() => buildLineageOutline(), []);
  const byGeneration = useMemo(() => {
    const groups = new Map<number, string[]>();
    for (const row of outline) {
      const list = groups.get(row.generation) ?? [];
      list.push(row.name);
      groups.set(row.generation, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [outline]);

  return (
    <>
      <Sheet>
        <div className="title-page">
          <h1 className="title-main">{t("book_title", lang)}</h1>
          <p className="title-year">{year}</p>
          <p className="title-meta">{pageCount} {t("book_page_count", lang)}</p>
        </div>
        <Footer lang={lang} stamp={stamp} />
      </Sheet>

      <Sheet>
        <Header lang={lang} year={year} />
        <h2 className="fm-h">{HISTORY_EDITORIAL.heading}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- print rendering */}
        <img src={HISTORY_PHOTO_URL} alt="" className="fm-photo" />
        <p className="fm-cap"><strong>{HISTORY_PHOTO.title}</strong> — {HISTORY_PHOTO.caption_intro}</p>
        {HISTORY_PHOTO.rows.map((r, i) => (
          <p key={i} className="fm-cap"><strong>{r.label}:</strong> {r.text}</p>
        ))}
        <p className="fm-note">{HISTORY_PHOTO.note}</p>
        {HISTORY_EDITORIAL.body.split("\n\n").map((para, i) => (
          <p key={i} className="fm-body">{para}</p>
        ))}
        <p className="fm-sign">{HISTORY_EDITORIAL.signature}</p>
        <p className="fm-note">{HISTORY_SOURCE_CREDIT}</p>
        <Footer lang={lang} stamp={stamp} />
      </Sheet>

      <Sheet>
        <Header lang={lang} year={year} />
        <h2 className="fm-h">{t("book_tree_heading", lang)}</h2>
        <ul className="bk-outline">
          {outline.map((row, i) => (
            <li key={i} style={{ paddingLeft: `${row.depth * 12}px` }} className="bk-outline-row">
              <span className="bk-outline-name">{row.name}</span>
              {row.note && <span className="bk-outline-note"> — {row.note}</span>}
              {row.page && <span className="bk-outline-page"> [{row.page}]</span>}
            </li>
          ))}
        </ul>
        <Footer lang={lang} stamp={stamp} />
      </Sheet>

      <Sheet>
        <Header lang={lang} year={year} />
        <h2 className="fm-h">{LINEAGE_HEADING}</h2>
        {byGeneration.map(([gen, names]) => (
          <div key={gen} className="gen-block">
            <h3 className="gen-h">{t("book_generation_label", lang)} {gen}</h3>
            <p className="gen-names">{names.join(" · ")}</p>
          </div>
        ))}
        <Footer lang={lang} stamp={stamp} />
      </Sheet>
    </>
  );
}

/* ─── Root ─────────────────────────────────────────────────────────────── */

export default function PrintClient({ edition }: { edition: Lang }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<DirectoryData | null>(null);
  const [error, setError] = useState("");
  const year = useMemo(() => new Date().getFullYear(), []);
  const stamp = useMemo(
    () => new Date().toLocaleDateString(edition === "en" ? "en-IN" : "hi-IN",
      { year: "numeric", month: "long", day: "numeric" }),
    [edition],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const d = await fetchDirectoryData(supabase);
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  const book = useMemo(() => (data ? buildBook(data) : []), [data]);

  const fatherNames = useMemo(() => {
    const byId = new Map<string, MemberRow>();
    for (const m of data?.members ?? []) byId.set(m.member_id, m);
    const out = new Map<string, string>();
    for (const m of data?.members ?? []) {
      const f = m.father_member_id ? byId.get(m.father_member_id) : undefined;
      out.set(m.member_id, f ? memberDisplayName(f, edition) || "" : m.father_name_raw || "");
    }
    return out;
  }, [data, edition]);

  if (error) return <div className="status">{t("book_build_failed", edition)}: {error}</div>;
  if (!data) return <div className="status">{t("book_building", edition)}</div>;

  return (
    <div className={`book ${edition === "en" ? "ed-en" : "ed-hi"}`}>
      {/* Screen-only. Auto-printing is deliberately not done: photos and
          webfonts must settle first, and a surprise print dialog is hostile. */}
      <div className="toolbar">
        <button onClick={() => window.print()} className="tb-btn">
          {t("adm_pdf_heading", edition)} — {book.length} {t("book_page_count", edition)}
        </button>
        <span className="tb-hint">{t("adm_pdf_hint", edition)}</span>
      </div>

      <FrontMatter lang={edition} year={year} pageCount={book.length} stamp={stamp} />

      {book.map((page) => (
        <MemberSheet
          key={page.registerId}
          page={page}
          lang={edition}
          year={year}
          stamp={stamp}
          fatherName={fatherNames.get(page.registerId) || ""}
        />
      ))}

      <style>{PRINT_CSS}</style>
    </div>
  );
}

/* ─── Print stylesheet ─────────────────────────────────────────────────── */

// Monochrome throughout, matching the register. The only colour in the whole
// document is the red लेटेस्ट फोटो placeholder text — text only, no box.
const PRINT_CSS = `
/* ── Why every class here is prefixed bk- ──────────────────────────────
   ROOT CAUSE of the S22/S23 defects, measured not guessed.

   globals.css does @import "tailwindcss". Tailwind v4 scans source files for
   class tokens and emits a utility for each one it finds, so the literal
   strings in this file's className attributes produced, in the app's built
   stylesheet:

       .grid    { display: grid; }      <- className="grid"       (every box)
       .block   { display: block; }     <- className="grid block"
       .outline { outline-width: 1px; } <- className="outline"

   Both .grid rules have specificity (0,1,0) and this stylesheet never
   declared a display of its own, so Tailwind's display:grid applied and
   every section table was a GRID CONTAINER, not a table. table-layout and
   the <col> skeleton are inert on a grid container, so the <td>s fell into
   an anonymous table box that shrink-wrapped to its own content — a
   different width and different divider positions in every box, on every
   entry, in both media. The gap between the correctly-sized container and
   that narrower anonymous table inside it was the "empty orphan column
   hanging off the right edge".

   This is why screen and print disagreed in S23: the screen check measured
   the outer element (the grid container, correctly 186mm) while the PDF
   showed the painted inner table. One bug, both media — it was never
   print-specific.

   The names are namespaced so no Tailwind utility can claim them again, and
   the structural rules below now state display explicitly so a future
   collision fails loudly instead of silently changing the layout mode.

   ── Physical page geometry ──
   This is an A4 artifact, so its widths are stated in millimetres, never as
   percentages of an ancestor. */
@page { size: A4 portrait; margin: 12mm; }

.book {
  /* A4 210mm wide, less the 12mm @page margin on each side. Every printed
     box below is exactly this wide — this is the single source of truth. */
  --page-w: 186mm;
  font-family: var(--font-noto-serif-devanagari), var(--font-fraunces), Georgia, serif;
  color: #000; background: #6e6e6e; padding: 16px 0;
}
.book.ed-en { font-family: var(--font-fraunces), var(--font-noto-serif-devanagari), Georgia, serif; }

.status { padding: 40px; text-align: center; font-size: 15px; }

.toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin: 0 auto 16px; max-width: 210mm; padding: 12px 14px;
  background: #2A0E12; color: #F4E3C1; border-radius: 8px;
}
.tb-btn {
  min-height: 40px; padding: 0 18px; border-radius: 6px;
  background: #C9962E; color: #2A0E12; font-weight: 600; font-size: 14px; cursor: pointer;
}
.tb-hint { font-size: 12px; opacity: .85; }

/* One printed page. The sheet IS the A4 content area — the paper margin comes
   from @page, not from padding here, so the sheet's width and the grid's width
   are the same number and the boxes can be checked against it directly. */
.sheet {
  width: var(--page-w); min-height: 273mm; box-sizing: border-box;  /* 297mm − 2 × 12mm */
  margin: 0 auto 14px; padding: 0;
  background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.35);
  display: flex; flex-direction: column;
  page-break-after: always; break-after: page;
}
.sheet:last-child { page-break-after: auto; break-after: auto; }

/* Header: black, centered, no rule beneath — as the register sets it. */
.bk-head {
  text-align: center; font-size: 19pt; font-weight: 700;
  margin: 0 0 6mm; letter-spacing: .2px;
}

/* Photo grid: one bordered box, equal cells, captions inside. */
.photos { border-collapse: collapse; margin: 0 auto 5mm; table-layout: fixed; }
.photos td { border: 0.8px solid #000; padding: 1.5mm; text-align: center; vertical-align: middle; }
.ph-cell { width: 26mm; height: 30mm; }
.ph-img { width: 100%; height: 26mm; object-fit: cover; display: block; }
.ph-empty { color: #c00; font-size: 8pt; font-weight: 600; line-height: 1.25; }
.ph-cap { font-size: 8pt; line-height: 1.25; height: 8mm; }

/* The shared skeleton. display is declared on both of these on purpose: it is
   the property a stray utility took over last time, and stating it here means
   any future collision loses to this rule instead of silently switching the
   box out of table layout. */
.bk-grid-stack { display: block; width: var(--page-w); }

/* The four-column grid. Labels right-aligned, no cell shading.
   width is the absolute A4 content width, not 100% of anything: with
   table-layout: fixed that makes the Cols() skeleton definite regardless of
   what any ancestor is doing, in either medium. */
.bk-grid {
  display: table;
  width: var(--page-w); table-layout: fixed;
  border-collapse: collapse; font-size: 9.5pt; border: 0.8px solid #000;
}
.bk-grid.bk-block { margin-top: 4mm; }
/* height acts as a minimum on table cells: single-line rows are all exactly
   this tall on every entry, and a wrapped value grows the row instead of
   letting a blank one collapse. */
.bk-grid td {
  border: 0.6px solid #000; padding: 1px 4px;
  vertical-align: top; line-height: 1.4; height: 5.2mm;
}
/* Labels wrap rather than overflow now that the column width is locked. */
.bk-grid .lbl { text-align: right; font-weight: 600; }
.bk-grid .val { text-align: left; overflow-wrap: anywhere; }
.bk-grid .numcell { text-align: center; font-weight: 700; letter-spacing: .3px; white-space: nowrap; }
.bk-grid .note-cell { border-left: 0.6px solid #000; }
.bk-grid .sec-cell { font-weight: 700; }
.sec-h { text-decoration: underline; text-underline-offset: 2px; }
.numbox-n, .numbox-id { font-weight: 700; }
.numbox-lang { letter-spacing: .8px; }
.bk-grid tr.bk-spacer td { border-left: 0; border-right: 0; height: 2mm; }

.bk-foot { margin-top: auto; padding-top: 4mm; font-size: 7.5pt; line-height: 1.4; }
.bk-foot-line { text-align: center; margin: 0; }
.bk-foot-date { text-align: right; margin: 1mm 0 0; }

.title-page { display: flex; flex-direction: column; flex: 1; text-align: center; justify-content: center; }
.title-main { font-size: 26pt; font-weight: 700; margin: 0 0 8px; line-height: 1.3; }
.title-year { font-size: 18pt; margin: 0 0 20px; }
.title-meta { font-size: 10pt; margin: 0; }

.fm-h { font-size: 15pt; margin: 2mm 0 3mm; text-align: center; text-decoration: underline; }
.fm-photo { width: 100%; max-height: 95mm; object-fit: contain; border: 0.8px solid #000; margin-bottom: 3mm; }
.fm-cap { font-size: 8.5pt; line-height: 1.4; margin: 0 0 2px; }
.fm-body { font-size: 9.5pt; line-height: 1.55; margin: 0 0 4px; text-align: justify; }
.fm-sign { font-size: 9.5pt; white-space: pre-line; margin: 4px 0; text-align: right; font-weight: 600; }
.fm-note { font-size: 7.5pt; line-height: 1.35; margin: 3px 0; }

.bk-outline { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 10mm; font-size: 8.5pt; }
.bk-outline-row { line-height: 1.45; break-inside: avoid; }
.bk-outline-name { font-weight: 500; }
.bk-outline-note, .bk-outline-page { font-size: 7.5pt; }

.gen-block { margin-bottom: 4px; break-inside: avoid; }
.gen-h { font-size: 10pt; margin: 0 0 2px; text-decoration: underline; }
.gen-names { font-size: 8.5pt; line-height: 1.5; margin: 0; }

@media print {
  /* Defensive, not the fix — the fix is the bk- namespace above. The app shell
     sets <html class="h-full"> and <body class="min-h-full flex flex-col">
     (src/app/layout.tsx), and LanguageProvider renders no wrapper, so .book is
     a direct flex item of <body>. A ~120-page document has no business being
     a fragmented flex container one page tall, so print puts it back to plain
     block layout. This deliberately reaches outside the route's own subtree;
     it is confined to print media, so the shell's screen layout is untouched. */
  html { height: auto; }
  body { display: block; min-height: 0; margin: 0; background: #fff; }
  .book { display: block; background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .toolbar { display: none !important; }
  /* width, padding and box-sizing stay as declared above — the sheet is
     already exactly the A4 content area. Only the screen furniture comes off.
     min-height is released so a short entry does not pad itself out and a long
     one spills onto a second page rather than being squeezed. */
  .sheet { display: block; min-height: 0; margin: 0; box-shadow: none; }
  .bk-grid, .gen-block, .bk-outline-row, .photos { break-inside: avoid; }
}
`;
