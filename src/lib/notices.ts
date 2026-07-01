import type { SupabaseClient } from "@supabase/supabase-js";

export interface Notice {
  id: string;
  category: NoticeCategory;
  title: string;
  body: string;
  title_en: string | null;
  body_en: string | null;
  image_url: string | null;
  event_date: string | null;
  created_at: string;
  is_mine: boolean;
  poster_member_id: string | null;
  poster_name: string | null;
  poster_name_en: string | null;
  poster_photo: string | null;
}

export type NoticeCategory = "wedding" | "birth" | "death" | "gathering" | "general";

export interface CategoryMeta {
  labelEn: string;
  labelHi: string;
  accent: string;
  icon: string;
}

export const CATEGORY_META: Record<NoticeCategory, CategoryMeta> = {
  wedding:   { labelEn: "Wedding",        labelHi: "विवाह",      accent: "var(--gold)",   icon: "💍" },
  birth:     { labelEn: "Birth",          labelHi: "जन्म",       accent: "var(--gold)",   icon: "👶" },
  death:     { labelEn: "In Remembrance", labelHi: "श्रद्धांजलि", accent: "var(--ink)",    icon: "🕯️" },
  gathering: { labelEn: "Gathering",      labelHi: "सभा",        accent: "var(--maroon)", icon: "🤝" },
  general:   { labelEn: "General",        labelHi: "सामान्य",     accent: "var(--maroon)", icon: "📢" },
};

export async function getNotices(
  supabase: SupabaseClient,
  limit = 50
): Promise<Notice[]> {
  const { data, error } = await supabase.rpc("get_notices", { p_limit: limit });
  if (error) {
    console.error("get_notices error:", error);
    return [];
  }
  return (data as Notice[]) || [];
}

export async function postNotice(
  supabase: SupabaseClient,
  payload: {
    p_category: NoticeCategory;
    p_title: string;
    p_body: string;
    p_title_en?: string | null;
    p_body_en?: string | null;
    p_image_url?: string | null;
    p_event_date?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("post_notice", payload);
  if (error) {
    console.error("post_notice error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function deleteNotice(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("delete_notice", { p_id: id });
  if (error) {
    console.error("delete_notice error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
