import type { SupabaseClient } from "@supabase/supabase-js";
import { LINEAGE_TREE, type LineageNode } from "./history-content";

/**
 * Assembles the printed register from live data.
 *
 * Everything here is derived at generation time and nothing is stored. The
 * whole book is built from five plain table reads — authenticated SELECT is
 * open on all five — so this feature adds no RPC and changes no schema.
 */

/* ─── Row shapes (only the columns the book prints) ────────────────────── */

export interface MemberRow {
  member_id: string;
  father_member_id: string | null;
  full_name: string;
  full_name_en: string | null;
  gender: string | null;
  is_deceased: boolean;
  marital_status: string | null;
  dob: string | null;
  date_of_death: string | null;
  education: string | null;
  education_en: string | null;
  occupation: string | null;
  occupation_en: string | null;
  mobile_1: string | null;
  mobile_2: string | null;
  email: string | null;
  addr_line1: string | null;
  addr_line1_en: string | null;
  addr_line2: string | null;
  addr_line2_en: string | null;
  city: string | null;
  city_en: string | null;
  state: string | null;
  state_en: string | null;
  country: string | null;
  country_en: string | null;
  pincode: string | null;
  gotra: string | null;
  gotra_en: string | null;
  husband_name: string | null;
  husband_name_en: string | null;
  father_name_raw: string | null;
  photo_url: string | null;
  sort_seq: number | null;
}

export interface SpouseRow {
  spouse_id: string;
  member_id: string;
  full_name: string;
  full_name_en: string | null;
  gender: string | null;
  dob: string | null;
  date_of_marriage: string | null;
  date_of_death: string | null;
  father_name: string | null;
  father_name_en: string | null;
  birth_gotra: string | null;
  birth_gotra_en: string | null;
  education: string | null;
  education_en: string | null;
  mobile: string | null;
  email: string | null;
  photo_url: string | null;
}

export interface ChildRow {
  child_id: string;
  parent_member_id: string;
  full_name: string;
  full_name_en: string | null;
  gender: string | null;
  dob: string | null;
  education: string | null;
  education_en: string | null;
  occupation: string | null;
  occupation_en: string | null;
  mobile: string | null;
  email: string | null;
  photo_url: string | null;
}

export interface MarriedDaughterRow {
  md_id: string;
  member_id: string | null;
  d_member_id: string | null;
  full_name: string | null;
  full_name_en: string | null;
  husband_name: string | null;
  husband_name_en: string | null;
  sasur_name: string | null;
  sasur_name_en: string | null;
  addr: string | null;
  addr_en: string | null;
  city: string | null;
  city_en: string | null;
  mobile: string | null;
  husband_mobile: string | null;
  sasur_mobile: string | null;
  email: string | null;
  education: string | null;
  education_en: string | null;
  occupation: string | null;
  occupation_en: string | null;
  dom: string | null;
  children_note: string | null;
  children_note_en: string | null;
}

export interface SpouseRelativeRow {
  relative_id: string;
  spouse_id: string;
  relation_code: string;
  relation_label: string | null;
  relation_label_en: string | null;
  full_name: string | null;
  full_name_en: string | null;
  addr: string | null;
  addr_en: string | null;
  city: string | null;
  city_en: string | null;
  mobile: string | null;
  sort_seq: number | null;
}

export interface DirectoryData {
  members: MemberRow[];
  spouses: SpouseRow[];
  children: ChildRow[];
  marriedDaughters: MarriedDaughterRow[];
  spouseRelatives: SpouseRelativeRow[];
}

/* ─── Fetch ────────────────────────────────────────────────────────────── */

// The register is 216 people today. The ceiling is explicit because PostgREST
// silently caps unbounded selects at 1000 rows, which would truncate the book
// without any visible error. Raise before the family reaches it.
const ROW_CEILING = 4000;

const MEMBER_COLUMNS =
  "member_id, father_member_id, full_name, full_name_en, gender, is_deceased, marital_status, " +
  "dob, date_of_death, education, education_en, occupation, occupation_en, mobile_1, mobile_2, email, " +
  "addr_line1, addr_line1_en, addr_line2, addr_line2_en, city, city_en, state, state_en, " +
  "country, country_en, pincode, gotra, gotra_en, husband_name, husband_name_en, " +
  "father_name_raw, photo_url, sort_seq";

export async function fetchDirectoryData(supabase: SupabaseClient): Promise<DirectoryData> {
  const [members, spouses, children, marriedDaughters, spouseRelatives] = await Promise.all([
    supabase.from("members").select(MEMBER_COLUMNS).limit(ROW_CEILING),
    supabase
      .from("spouses")
      .select(
        "spouse_id, member_id, full_name, full_name_en, gender, dob, date_of_marriage, date_of_death, " +
        "father_name, father_name_en, birth_gotra, birth_gotra_en, education, education_en, mobile, email, photo_url",
      )
      .is("removed_at", null)
      .limit(ROW_CEILING),
    supabase
      .from("children")
      .select(
        "child_id, parent_member_id, full_name, full_name_en, gender, dob, education, education_en, " +
        "occupation, occupation_en, mobile, email, photo_url",
      )
      .is("removed_at", null)
      .limit(ROW_CEILING),
    supabase
      .from("married_daughters")
      .select(
        "md_id, member_id, d_member_id, full_name, full_name_en, husband_name, husband_name_en, " +
        "sasur_name, sasur_name_en, addr, addr_en, city, city_en, mobile, husband_mobile, sasur_mobile, " +
        "email, education, education_en, occupation, occupation_en, dom, children_note, children_note_en",
      )
      .is("removed_at", null)
      .limit(ROW_CEILING),
    supabase
      .from("spouse_relatives")
      .select(
        "relative_id, spouse_id, relation_code, relation_label, relation_label_en, full_name, full_name_en, " +
        "addr, addr_en, city, city_en, mobile, sort_seq",
      )
      .is("removed_at", null)
      .limit(ROW_CEILING),
  ]);

  const firstError =
    members.error || spouses.error || children.error || marriedDaughters.error || spouseRelatives.error;
  if (firstError) throw new Error(`Directory fetch failed: ${firstError.message}`);

  // The untyped client returns a row-or-error union for string selects; the
  // error case is already handled above, so the shapes are asserted here.
  return {
    members: (members.data ?? []) as unknown as MemberRow[],
    spouses: (spouses.data ?? []) as unknown as SpouseRow[],
    children: (children.data ?? []) as unknown as ChildRow[],
    marriedDaughters: (marriedDaughters.data ?? []) as unknown as MarriedDaughterRow[],
    spouseRelatives: (spouseRelatives.data ?? []) as unknown as SpouseRelativeRow[],
  };
}

/* ─── Page allocation ──────────────────────────────────────────────────── */

/** A D-id is a married daughter; she is printed on her father's page, never her own. */
export function isDaughterId(memberId: string): boolean {
  return /^D/.test(memberId);
}

/**
 * The one rule: a man gets his own page when he marries. Until then he appears
 * as an unmarried child on his father's page.
 */
export function isPageMember(m: MemberRow): boolean {
  return m.marital_status === "married" && !isDaughterId(m.member_id);
}

/**
 * An unmarried child of this member, from EITHER source.
 *
 * The union is not optional. complete_registration's child-claim path DELETES
 * the children row and creates an N-member, so a family that registers its
 * children would vanish from the book if this read `children` alone —
 * M0011 भावेश already has zero children rows and two unmarried N-sons.
 */
export interface UnmarriedChild {
  key: string;
  source: "child" | "member";
  member_id: string | null;
  full_name: string;
  full_name_en: string | null;
  gender: string | null;
  dob: string | null;
  education: string | null;
  education_en: string | null;
  occupation: string | null;
  occupation_en: string | null;
  mobile: string | null;
  email: string | null;
  photo_url: string | null;
  is_deceased: boolean;
}

/** Parse a YYYY-MM-DD dob into a sortable number; nulls sort last. */
function dobKey(dob: string | null): number {
  if (!dob) return Number.POSITIVE_INFINITY;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return Number.POSITIVE_INFINITY;
  return +m[1] * 10000 + +m[2] * 100 + +m[3];
}

/**
 * Sibling order: date of birth where present, then register id, then sort_seq.
 *
 * sort_seq is deliberately the LAST resort. It is a banded import artifact —
 * M-rows are 1000000000+n and N-rows are 3000000000+n — so ordering by it
 * would exile every future registrant to the back of the book. N0006, a
 * married son of M0095, sorts at 3000000006.
 */
function compareSiblings(a: MemberRow, b: MemberRow): number {
  const byDob = dobKey(a.dob) - dobKey(b.dob);
  if (byDob !== 0 && Number.isFinite(byDob)) return byDob;
  if (dobKey(a.dob) !== dobKey(b.dob)) return dobKey(a.dob) - dobKey(b.dob);
  const byId = a.member_id.localeCompare(b.member_id);
  if (byId !== 0) return byId;
  return (a.sort_seq ?? Infinity) - (b.sort_seq ?? Infinity);
}

export interface BookPage {
  /** 1-based, renumbered fresh on every generation. */
  pageNumber: number;
  /** The stable handle back to the app — the only thing that survives renumbering. */
  registerId: string;
  member: MemberRow;
  spouse: SpouseRow | null;
  unmarriedChildren: UnmarriedChild[];
  relatives: SpouseRelativeRow[];
  daughters: { member: MemberRow; detail: MarriedDaughterRow | null }[];
  /** Continuation slices for the married-daughters block, if it overflows. */
  daughterOverflow: { member: MemberRow; detail: MarriedDaughterRow | null }[][];
}

// Tuned against the live distribution (max 5 daughters for one father; 1→25,
// 2→13, 3→11, 4→2, 5→1), so a continuation page is rare today. These are the
// knobs to turn after the owner sees real print output.
export const DAUGHTERS_ON_FIRST_PAGE = 2;
export const DAUGHTERS_PER_CONTINUATION = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Depth-first genealogical order: a father, then his married sons in birth
 * order, recursively. Never ordered by sort_seq.
 */
export function buildBook(data: DirectoryData): BookPage[] {
  const { members, spouses, children, marriedDaughters, spouseRelatives } = data;

  const childrenByParent = new Map<string, ChildRow[]>();
  for (const c of children) {
    const list = childrenByParent.get(c.parent_member_id) ?? [];
    list.push(c);
    childrenByParent.set(c.parent_member_id, list);
  }

  const membersByFather = new Map<string, MemberRow[]>();
  for (const m of members) {
    if (!m.father_member_id) continue;
    const list = membersByFather.get(m.father_member_id) ?? [];
    list.push(m);
    membersByFather.set(m.father_member_id, list);
  }

  const spouseByMember = new Map<string, SpouseRow>();
  for (const s of spouses) if (!spouseByMember.has(s.member_id)) spouseByMember.set(s.member_id, s);

  const relativesBySpouse = new Map<string, SpouseRelativeRow[]>();
  for (const r of spouseRelatives) {
    const list = relativesBySpouse.get(r.spouse_id) ?? [];
    list.push(r);
    relativesBySpouse.set(r.spouse_id, list);
  }

  const mdByDaughterId = new Map<string, MarriedDaughterRow>();
  for (const md of marriedDaughters) if (md.d_member_id) mdByDaughterId.set(md.d_member_id, md);

  function unmarriedChildrenOf(memberId: string): UnmarriedChild[] {
    const fromChildren: UnmarriedChild[] = (childrenByParent.get(memberId) ?? []).map((c) => ({
      key: `c:${c.child_id}`,
      source: "child",
      member_id: null,
      full_name: c.full_name,
      full_name_en: c.full_name_en,
      gender: c.gender,
      dob: c.dob,
      education: c.education,
      education_en: c.education_en,
      occupation: c.occupation,
      occupation_en: c.occupation_en,
      mobile: c.mobile,
      email: c.email,
      photo_url: c.photo_url,
      is_deceased: false,
    }));

    const fromMembers: UnmarriedChild[] = (membersByFather.get(memberId) ?? [])
      .filter((m) => m.marital_status !== "married" && !isDaughterId(m.member_id))
      .map((m) => ({
        key: `m:${m.member_id}`,
        source: "member",
        member_id: m.member_id,
        full_name: m.full_name,
        full_name_en: m.full_name_en,
        gender: m.gender,
        dob: m.dob,
        education: m.education,
        education_en: m.education_en,
        occupation: m.occupation,
        occupation_en: m.occupation_en,
        mobile: m.mobile_1,
        email: m.email,
        photo_url: m.photo_url,
        is_deceased: m.is_deceased,
      }));

    return [...fromChildren, ...fromMembers].sort(
      (a, b) => dobKey(a.dob) - dobKey(b.dob) || a.full_name.localeCompare(b.full_name),
    );
  }

  function daughtersOf(memberId: string) {
    return (membersByFather.get(memberId) ?? [])
      .filter((m) => isDaughterId(m.member_id))
      .sort(compareSiblings)
      .map((m) => ({ member: m, detail: mdByDaughterId.get(m.member_id) ?? null }));
  }

  const pages: BookPage[] = [];

  function emit(m: MemberRow) {
    const spouse = spouseByMember.get(m.member_id) ?? null;
    const allDaughters = daughtersOf(m.member_id);
    const first = allDaughters.slice(0, DAUGHTERS_ON_FIRST_PAGE);
    const rest = allDaughters.slice(DAUGHTERS_ON_FIRST_PAGE);

    pages.push({
      pageNumber: pages.length + 1,
      registerId: m.member_id,
      member: m,
      spouse,
      unmarriedChildren: unmarriedChildrenOf(m.member_id),
      relatives: spouse ? (relativesBySpouse.get(spouse.spouse_id) ?? []).slice().sort(
        (a, b) => (a.sort_seq ?? Infinity) - (b.sort_seq ?? Infinity) || a.relative_id.localeCompare(b.relative_id),
      ) : [],
      daughters: first,
      daughterOverflow: chunk(rest, DAUGHTERS_PER_CONTINUATION),
    });
  }

  const seen = new Set<string>();
  function walk(m: MemberRow) {
    if (seen.has(m.member_id)) return; // defensive: a cycle would otherwise hang the browser
    seen.add(m.member_id);
    if (isPageMember(m)) emit(m);
    const marriedSons = (membersByFather.get(m.member_id) ?? [])
      .filter(isPageMember)
      .sort(compareSiblings);
    for (const son of marriedSons) walk(son);
  }

  const roots = members.filter((m) => !m.father_member_id).sort(compareSiblings);
  for (const root of roots) walk(root);

  // Safety net: anything the walk could not reach still belongs in the book.
  const unreached = members.filter((m) => isPageMember(m) && !seen.has(m.member_id)).sort(compareSiblings);
  for (const m of unreached) walk(m);

  return pages;
}

/* ─── Lineage outline (front matter items 2 and 3) ─────────────────────── */

export interface OutlineRow {
  name: string;
  depth: number;
  generation: number;
  page?: string | null;
  note?: string | null;
}

/**
 * One flattening of LINEAGE_TREE, rendered twice: once as an indented outline
 * (the "family tree" page) and once grouped under generation headings (the
 * पीढ़ी chart). Two presentations, one generator.
 */
export function buildLineageOutline(nodes: LineageNode[] = LINEAGE_TREE): OutlineRow[] {
  const rows: OutlineRow[] = [];
  function visit(node: LineageNode, depth: number) {
    rows.push({
      name: node.name,
      depth,
      generation: node.generation,
      page: node.page ?? null,
      note: node.note ?? null,
    });
    for (const child of node.children ?? []) visit(child, depth + 1);
  }
  for (const n of nodes) visit(n, 0);
  return rows;
}
