import type { SupabaseClient } from "@supabase/supabase-js";

export interface Celebration {
  kind: "birthday" | "anniversary";
  link_member_id: string;
  full_name: string;
  full_name_en: string | null;
  photo_url: string | null;
  partner_name: string | null;
  partner_name_en: string | null;
  next_date: string;
  days_until: number;
  years: number | null;
}

export async function getCelebrations(
  supabase: SupabaseClient,
  days = 45
): Promise<Celebration[]> {
  const { data, error } = await supabase.rpc("get_celebrations", { p_days: days });
  if (error) {
    console.error("get_celebrations error:", error);
    return [];
  }
  return (data as Celebration[]) || [];
}
