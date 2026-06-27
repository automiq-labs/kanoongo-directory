import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the current user's "home" member_id.
 * Checks families.auth_user_id first (head members),
 * then family_logins (spouse logins) as fallback.
 */
export async function resolveMyMember(
  supabase: SupabaseClient
): Promise<{ memberId: string | null; familyId: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { memberId: null, familyId: null };

  // 1. Check if user is a family head
  const { data: fam } = await supabase
    .from("families")
    .select("id, head_member_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (fam?.head_member_id) {
    return { memberId: fam.head_member_id, familyId: fam.id };
  }

  // 2. Fallback: check family_logins (spouse logins)
  const { data: login } = await supabase
    .from("family_logins")
    .select("family_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (login?.family_id) {
    const { data: linkedFam } = await supabase
      .from("families")
      .select("id, head_member_id")
      .eq("id", login.family_id)
      .single();

    if (linkedFam?.head_member_id) {
      return { memberId: linkedFam.head_member_id, familyId: linkedFam.id };
    }
  }

  return { memberId: null, familyId: null };
}
