"use client";

import { useEffect, useMemo, useState } from "react";
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
  type UnmarriedChild,
} from "@/lib/directory-book";

/* ─── Small helpers ────────────────────────────────────────────────────── */

/** dates are TEXT and ISO when present; anything else prints as stored. */
function fmtDate(value: string | null): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

function joinParts(parts: (string | null | undefined)[]): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
}

function contactLine(mobile: string | null, extra: string | null, email: string | null): string {
  return joinParts([mobile, extra, email]);
}

function relationLabel(r: SpouseRelativeRow, lang: Lang): string {
  const custom = bi(r.relation_label, r.relation_label_en, lang);
  if (custom) return custom;
  const opt = RELATION_OPTIONS.find((o) => o.code === r.relation_code);
  return opt ? (lang === "en" ? opt.en : opt.hi) : r.relation_code;
}

/* ─── Layout atoms ─────────────────────────────────────────────────────── */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="lbl">{label}</td>
      <td className="val">{value || " "}</td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sec">
      <h3 className="sec-h">{title}</h3>
      {children}
    </section>
  );
}

function PhotoFrame({ url, caption, lang }: { url: string | null; caption: string; lang: Lang }) {
  return (
    <figure className="pf">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- print rendering; next/image adds no value here
        <img src={url} alt="" className="pf-img" />
      ) : (
        <div className="pf-empty">{t("book_photo_placeholder", lang)}</div>
      )}
      <figcaption className="pf-cap">{caption}</figcaption>
    </figure>
  );
}

/* ─── The page furniture ───────────────────────────────────────────────── */

function Header({ lang, year }: { lang: Lang; year: number }) {
  return (
    <header className="bk-head">
      {t("book_title", lang)} {year}
    </header>
  );
}

function NumberBox({
  pageNumber,
  registerId,
  lang,
  continued,
}: {
  pageNumber: number;
  registerId: string;
  lang: Lang;
  continued?: boolean;
}) {
  return (
    <div className="numbox">
      <span className="numbox-n">{String(pageNumber).padStart(3, "0")}</span>
      <span className="numbox-sep">·</span>
      <span className="numbox-id">{registerId}</span>
      <span className="numbox-sep">·</span>
      <span className="numbox-lang">{lang === "en" ? "ENGLISH" : "HINDI"}</span>
      {continued && <span className="numbox-cont">{t("book_continued", lang)}</span>}
    </div>
  );
}

function Footer({ lang }: { lang: Lang }) {
  return <footer className="bk-foot">{t("footer_attribution", lang)}</footer>;
}

function Sheet({ children }: { children: React.ReactNode }) {
  return <div className="sheet">{children}</div>;
}

/* ─── Member page ──────────────────────────────────────────────────────── */

function DaughterBlock({
  entry,
  lang,
}: {
  entry: { member: MemberRow; detail: MarriedDaughterRow | null };
  lang: Lang;
}) {
  const { member, detail } = entry;
  const name = memberDisplayName(member, lang) || bi(detail?.full_name ?? null, detail?.full_name_en ?? null, lang) || "";
  const husband = bi(detail?.husband_name ?? null, detail?.husband_name_en ?? null, lang) || "";
  const sasur = bi(detail?.sasur_name ?? null, detail?.sasur_name_en ?? null, lang) || "";
  const addr = joinParts([
    bi(detail?.addr ?? null, detail?.addr_en ?? null, lang),
    bi(detail?.city ?? null, detail?.city_en ?? null, lang),
  ]);
  const edu = bi(detail?.education ?? null, detail?.education_en ?? null, lang) || "";
  const occ = bi(detail?.occupation ?? null, detail?.occupation_en ?? null, lang) || "";
  const kids = bi(detail?.children_note ?? null, detail?.children_note_en ?? null, lang) || "";

  return (
    <div className="dgt">
      <div className="dgt-name">
        {name}
        <span className="dgt-id">{member.member_id}</span>
      </div>
      <table className="grid">
        <tbody>
          <Row label={t("label_husband", lang)} value={husband} />
          <Row label={t("label_sasur", lang)} value={sasur} />
          <Row label={t("label_address", lang)} value={addr} />
          <Row label={t("label_dom", lang)} value={fmtDate(detail?.dom ?? null)} />
          <Row label={t("label_education", lang)} value={edu} />
          <Row label={t("label_occupation", lang)} value={occ} />
          <Row
            label={t("label_mobile", lang)}
            value={joinParts([detail?.mobile ?? null, detail?.husband_mobile ?? null, detail?.sasur_mobile ?? null, detail?.email ?? null])}
          />
          <Row label={t("label_children_note", lang)} value={kids} />
        </tbody>
      </table>
    </div>
  );
}

function MemberSheet({
  page,
  lang,
  year,
  fatherName,
}: {
  page: BookPage;
  lang: Lang;
  year: number;
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

  const relativeGroups = useMemo(() => {
    const groups = new Map<string, SpouseRelativeRow[]>();
    for (const r of page.relatives) {
      const list = groups.get(r.relation_code) ?? [];
      list.push(r);
      groups.set(r.relation_code, list);
    }
    return Array.from(groups.entries()).sort(
      (a, b) => (RELATION_SORT_ORDER[a[0]] ?? 50) - (RELATION_SORT_ORDER[b[0]] ?? 50),
    );
  }, [page.relatives]);

  return (
    <>
      <Sheet>
        <Header lang={lang} year={year} />
        <NumberBox pageNumber={page.pageNumber} registerId={page.registerId} lang={lang} />

        {/* Photo strip — member, wife, then each unmarried child */}
        <div className="strip">
          <PhotoFrame url={m.photo_url} caption={name} lang={lang} />
          {s && (
            <PhotoFrame url={s.photo_url} caption={spouseDisplayName(s, lang) || ""} lang={lang} />
          )}
          {page.unmarriedChildren.map((c: UnmarriedChild) => (
            <PhotoFrame
              key={c.key}
              url={c.photo_url}
              caption={bi(c.full_name, c.full_name_en, lang) || ""}
              lang={lang}
            />
          ))}
        </div>

        <Section title={t("book_sec_personal", lang)}>
          <table className="grid">
            <tbody>
              <Row label={t("label_full_name", lang)} value={name} />
              <Row label={t("label_father_name", lang)} value={fatherName} />
              <Row label={t("label_occupation", lang)} value={bi(m.occupation, m.occupation_en, lang) || ""} />
              <Row label={t("label_dob", lang)} value={fmtDate(m.dob)} />
              {m.is_deceased && m.date_of_death && (
                <Row label={t("label_dod", lang)} value={fmtDate(m.date_of_death)} />
              )}
              <Row label={t("label_education", lang)} value={bi(m.education, m.education_en, lang) || ""} />
              <Row label={t("book_caste_gotra", lang)} value={bi(m.gotra, m.gotra_en, lang) || ""} />
              <Row label={t("label_address", lang)} value={address} />
              <Row label={t("label_mobile", lang)} value={contactLine(m.mobile_1, m.mobile_2, m.email)} />
            </tbody>
          </table>
        </Section>

        {/* 6 married men have no spouse row — the block still prints, blank,
            exactly as the printed register does. */}
        <Section title={t("book_sec_wife", lang)}>
          <table className="grid">
            <tbody>
              <Row label={t("label_full_name", lang)} value={s ? spouseDisplayName(s, lang) || "" : ""} />
              <Row label={t("label_dob", lang)} value={fmtDate(s?.dob ?? null)} />
              <Row label={t("label_dom", lang)} value={fmtDate(s?.date_of_marriage ?? null)} />
              {s?.date_of_death && <Row label={t("label_dod", lang)} value={fmtDate(s.date_of_death)} />}
              <Row label={t("label_father_name", lang)} value={bi(s?.father_name ?? null, s?.father_name_en ?? null, lang) || ""} />
              <Row label={t("book_caste_gotra", lang)} value={bi(s?.birth_gotra ?? null, s?.birth_gotra_en ?? null, lang) || ""} />
              <Row label={t("label_education", lang)} value={bi(s?.education ?? null, s?.education_en ?? null, lang) || ""} />
              <Row label={t("label_mobile", lang)} value={contactLine(s?.mobile ?? null, null, s?.email ?? null)} />
            </tbody>
          </table>
        </Section>

        {page.unmarriedChildren.length > 0 && (
          <Section title={t("book_sec_children", lang)}>
            <table className="grid cols">
              <tbody>
                {page.unmarriedChildren.map((c) => (
                  <tr key={c.key}>
                    <td className="val strong">{bi(c.full_name, c.full_name_en, lang)}</td>
                    <td className="val">{bi(c.education, c.education_en, lang)}</td>
                    <td className="val">{fmtDate(c.dob)}</td>
                    <td className="val">{bi(c.occupation, c.occupation_en, lang)}</td>
                    <td className="val">{contactLine(c.mobile, null, c.email)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {relativeGroups.length > 0 && (
          <Section title={t("book_sec_sasural", lang)}>
            <table className="grid cols">
              <tbody>
                {relativeGroups.map(([code, list]) =>
                  list.map((r, i) => (
                    <tr key={r.relative_id}>
                      <td className="lbl">{i === 0 ? relationLabel(r, lang) : " "}</td>
                      <td className="val strong">{bi(r.full_name, r.full_name_en, lang)}</td>
                      <td className="val">
                        {joinParts([bi(r.addr, r.addr_en, lang), bi(r.city, r.city_en, lang)])}
                      </td>
                      <td className="val">{r.mobile || ""}</td>
                      <td className="val" data-code={code} />
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </Section>
        )}

        {page.daughters.length > 0 && (
          <Section title={t("book_sec_daughters", lang)}>
            {page.daughters.map((d) => (
              <DaughterBlock key={d.member.member_id} entry={d} lang={lang} />
            ))}
          </Section>
        )}

        <Footer lang={lang} />
      </Sheet>

      {/* Continuation sheets — same register id, marked (क्रमशः) */}
      {page.daughterOverflow.map((slice, i) => (
        <Sheet key={`cont-${i}`}>
          <Header lang={lang} year={year} />
          <NumberBox pageNumber={page.pageNumber} registerId={page.registerId} lang={lang} continued />
          <Section title={`${t("book_sec_daughters", lang)} ${t("book_continued", lang)}`}>
            {slice.map((d) => (
              <DaughterBlock key={d.member.member_id} entry={d} lang={lang} />
            ))}
          </Section>
          <Footer lang={lang} />
        </Sheet>
      ))}
    </>
  );
}

/* ─── Front matter ─────────────────────────────────────────────────────── */

function FrontMatter({ lang, year, pageCount }: { lang: Lang; year: number; pageCount: number }) {
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
      {/* Title */}
      <Sheet>
        <div className="title-page">
          <h1 className="title-main">{t("book_title", lang)}</h1>
          <p className="title-year">{year}</p>
          <p className="title-meta">
            {pageCount} {t("book_page_count", lang)} · {t("book_generated_on", lang)}{" "}
            {new Date().toLocaleDateString(lang === "en" ? "en-IN" : "hi-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <Footer lang={lang} />
        </div>
      </Sheet>

      {/* Family history */}
      <Sheet>
        <Header lang={lang} year={year} />
        <h2 className="fm-h">{HISTORY_EDITORIAL.heading}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- print rendering */}
        <img src={HISTORY_PHOTO_URL} alt="" className="fm-photo" />
        <p className="fm-cap">
          <strong>{HISTORY_PHOTO.title}</strong> — {HISTORY_PHOTO.caption_intro}
        </p>
        {HISTORY_PHOTO.rows.map((r, i) => (
          <p key={i} className="fm-cap">
            <strong>{r.label}:</strong> {r.text}
          </p>
        ))}
        <p className="fm-note">{HISTORY_PHOTO.note}</p>
        {HISTORY_EDITORIAL.body.split("\n\n").map((para, i) => (
          <p key={i} className="fm-body">{para}</p>
        ))}
        <p className="fm-sign">{HISTORY_EDITORIAL.signature}</p>
        <p className="fm-note">{HISTORY_SOURCE_CREDIT}</p>
        <Footer lang={lang} />
      </Sheet>

      {/* Family tree — indented outline (216 people do not fit a drawn tree) */}
      <Sheet>
        <Header lang={lang} year={year} />
        <h2 className="fm-h">{t("book_tree_heading", lang)}</h2>
        <ul className="outline">
          {outline.map((row, i) => (
            <li key={i} style={{ paddingLeft: `${row.depth * 12}px` }} className="outline-row">
              <span className="outline-name">{row.name}</span>
              {row.note && <span className="outline-note"> — {row.note}</span>}
              {row.page && <span className="outline-page"> [{row.page}]</span>}
            </li>
          ))}
        </ul>
        <Footer lang={lang} />
      </Sheet>

      {/* Same outline, grouped under generation headings */}
      <Sheet>
        <Header lang={lang} year={year} />
        <h2 className="fm-h">{LINEAGE_HEADING}</h2>
        {byGeneration.map(([gen, names]) => (
          <div key={gen} className="gen-block">
            <h3 className="gen-h">
              {t("book_generation_label", lang)} {gen}
            </h3>
            <p className="gen-names">{names.join(" · ")}</p>
          </div>
        ))}
        <Footer lang={lang} />
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

  if (error) {
    return <div className="status">Could not build the directory: {error}</div>;
  }
  if (!data) {
    return <div className="status">Assembling the directory…</div>;
  }

  return (
    <div className={`book ${edition === "en" ? "ed-en" : "ed-hi"}`}>
      {/* Screen-only control. Auto-printing is deliberately not done: photos and
          webfonts must settle first, and a surprise print dialog is hostile. */}
      <div className="toolbar">
        <button onClick={() => window.print()} className="tb-btn">
          {t("adm_pdf_heading", edition)} — {book.length} {t("book_page_count", edition)}
        </button>
        <span className="tb-hint">{t("adm_pdf_hint", edition)}</span>
      </div>

      <FrontMatter lang={edition} year={year} pageCount={book.length} />

      {book.map((page) => (
        <MemberSheet
          key={page.registerId}
          page={page}
          lang={edition}
          year={year}
          fatherName={fatherNames.get(page.registerId) || ""}
        />
      ))}

      <style>{PRINT_CSS}</style>
    </div>
  );
}

/* ─── Print stylesheet ─────────────────────────────────────────────────── */

const PRINT_CSS = `
/* A4 portrait with a wide binding margin on the spiral edge (left). */
@page { size: A4 portrait; margin: 12mm 12mm 14mm 20mm; }

.book {
  font-family: var(--font-noto-serif-devanagari), var(--font-fraunces), Georgia, serif;
  color: #1a1a1a;
  background: #6e6e6e;
  padding: 16px 0;
}
.book.ed-en { font-family: var(--font-fraunces), var(--font-noto-serif-devanagari), Georgia, serif; }

.status { padding: 40px; text-align: center; font-size: 15px; color: var(--maroon); }

.toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin: 0 auto 16px; max-width: 210mm; padding: 12px 14px;
  background: var(--ink); color: #F4E3C1; border-radius: 8px;
}
.tb-btn {
  min-height: 40px; padding: 0 18px; border-radius: 6px;
  background: var(--gold); color: #2A0E12; font-weight: 600; font-size: 14px; cursor: pointer;
}
.tb-hint { font-size: 12px; opacity: .85; }

/* One sheet = one printed page. */
.sheet {
  width: 210mm; min-height: 297mm; box-sizing: border-box;
  margin: 0 auto 14px; padding: 14mm 12mm 12mm 18mm;
  background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.35);
  display: flex; flex-direction: column;
  page-break-after: always; break-after: page;
}
.sheet:last-child { page-break-after: auto; break-after: auto; }

.bk-head {
  text-align: center; font-size: 13pt; font-weight: 700; letter-spacing: .2px;
  border-bottom: 2px solid #6E1E2A; padding-bottom: 4px; margin-bottom: 6px; color: #6E1E2A;
}
.numbox {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
  border: 1.5px solid #1a1a1a; padding: 2px 8px; font-size: 9pt; letter-spacing: .5px; margin-bottom: 8px;
}
.numbox-n { font-weight: 700; }
.numbox-id { font-weight: 600; }
.numbox-sep { opacity: .5; }
.numbox-lang { font-size: 8pt; letter-spacing: 1px; }
.numbox-cont { font-size: 8pt; font-style: italic; margin-left: 4px; }

.strip { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.pf { width: 30mm; margin: 0; }
.pf-img, .pf-empty {
  width: 30mm; height: 36mm; object-fit: cover; display: block;
  border: 1px solid #1a1a1a; box-sizing: border-box;
}
.pf-empty {
  display: flex; align-items: center; justify-content: center; text-align: center;
  background: #fdecec; border: 1.5px solid #c62828; color: #c62828;
  font-size: 8pt; font-weight: 700; padding: 2px;
}
.pf-cap { font-size: 8pt; text-align: center; margin-top: 2px; line-height: 1.2; }

.sec { margin-top: 7px; }
.sec-h {
  font-size: 10.5pt; font-weight: 700; color: #fff; background: #6E1E2A;
  padding: 2px 6px; margin: 0 0 3px;
}
.grid { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.grid td { border: 0.7px solid #999; padding: 2px 5px; vertical-align: top; line-height: 1.35; }
.grid .lbl { width: 34mm; font-weight: 600; background: #f4f1ea; white-space: nowrap; }
.grid.cols .lbl { width: 22mm; }
.grid .val.strong { font-weight: 600; }

.dgt { margin-bottom: 6px; border: 0.7px solid #999; }
.dgt-name {
  font-weight: 700; font-size: 10pt; background: #f4f1ea;
  padding: 2px 6px; border-bottom: 0.7px solid #999;
}
.dgt-id { font-weight: 400; font-size: 8pt; opacity: .6; margin-left: 6px; }
.dgt .grid { border: 0; }

.bk-foot {
  margin-top: auto; padding-top: 6px; border-top: 1px solid #6E1E2A;
  font-size: 7.5pt; line-height: 1.35; text-align: center; color: #4a4a4a;
}

.title-page { display: flex; flex-direction: column; height: 100%; text-align: center; justify-content: center; }
.title-main { font-size: 26pt; font-weight: 700; color: #6E1E2A; margin: 0 0 8px; line-height: 1.3; }
.title-year { font-size: 18pt; margin: 0 0 20px; }
.title-meta { font-size: 10pt; color: #4a4a4a; margin: 0 0 auto; }

.fm-h { font-size: 15pt; color: #6E1E2A; margin: 6px 0 8px; text-align: center; }
.fm-photo { width: 100%; max-height: 95mm; object-fit: contain; border: 1px solid #999; margin-bottom: 6px; }
.fm-cap { font-size: 8.5pt; line-height: 1.4; margin: 0 0 3px; }
.fm-body { font-size: 9.5pt; line-height: 1.55; margin: 0 0 6px; text-align: justify; }
.fm-sign { font-size: 9.5pt; white-space: pre-line; margin: 6px 0; text-align: right; font-weight: 600; }
.fm-note { font-size: 7.5pt; color: #555; line-height: 1.35; margin: 4px 0; }

.outline { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 10mm; font-size: 8.5pt; }
.outline-row { line-height: 1.45; break-inside: avoid; }
.outline-name { font-weight: 500; }
.outline-note, .outline-page { font-size: 7.5pt; color: #666; }

.gen-block { margin-bottom: 6px; break-inside: avoid; }
.gen-h { font-size: 10pt; color: #6E1E2A; margin: 0 0 2px; border-bottom: 0.7px solid #ccc; }
.gen-names { font-size: 8.5pt; line-height: 1.5; margin: 0; }

@media print {
  /* Keep the maroon headings and the red photo placeholder on paper. */
  .book { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .toolbar { display: none !important; }
  .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .sec, .dgt, .gen-block, .outline-row { break-inside: avoid; }
  .sec-h, .dgt-name { break-after: avoid; }
}
`;
