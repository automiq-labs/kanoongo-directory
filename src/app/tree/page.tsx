import { createClient } from "@/lib/supabase/server";
import TreeClient from "./tree-client";

interface RootMember {
  member_id: string;
  full_name: string;
  full_name_en: string | null;
  is_deceased: boolean;
}

interface RootSpouse {
  member_id: string;
  full_name: string;
  full_name_en: string | null;
  date_of_death: string | null;
}

interface ChildCount {
  father_member_id: string;
  count: number;
}

export default async function TreePage() {
  const supabase = await createClient();

  // Fetch root members (no father)
  const { data: roots } = await supabase
    .from("members")
    .select("member_id, full_name, full_name_en, is_deceased")
    .is("father_member_id", null)
    .order("full_name");

  const rootIds = (roots || []).map((r) => r.member_id);

  // Fetch spouses for roots, and child counts for roots — in parallel
  const [spouseResult, countResult] = await Promise.all([
    supabase
      .from("spouses")
      .select("member_id, full_name, full_name_en, date_of_death")
      .in("member_id", rootIds),
    supabase
      .from("members")
      .select("father_member_id")
      .in("father_member_id", rootIds),
  ]);

  // Build spouse map
  const spouseMap: Record<string, RootSpouse[]> = {};
  for (const s of (spouseResult.data || []) as RootSpouse[]) {
    if (!spouseMap[s.member_id]) spouseMap[s.member_id] = [];
    spouseMap[s.member_id].push(s);
  }

  // Build child count map
  const countMap: Record<string, number> = {};
  for (const row of (countResult.data || []) as { father_member_id: string }[]) {
    countMap[row.father_member_id] = (countMap[row.father_member_id] || 0) + 1;
  }

  const rootsWithMeta = ((roots || []) as RootMember[]).map((r) => ({
    ...r,
    spouses: spouseMap[r.member_id] || [],
    childCount: countMap[r.member_id] || 0,
  }));

  return <TreeClient roots={rootsWithMeta} />;
}
