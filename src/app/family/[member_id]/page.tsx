import { createClient } from "@/lib/supabase/server";
import { Member, Spouse, Child } from "@/lib/types";
import { notFound } from "next/navigation";
import FamilyCardClient from "./family-card-client";

interface FamilyCardRpc {
  found: boolean;
  member: Member;
  can_edit: boolean;
  is_own_card: boolean;
  spouses: Spouse[];
  children: Child[];
  member_children: {
    member_id: string;
    full_name: string;
    full_name_en: string | null;
    gender: string | null;
    dob: string | null;
    marital_status: string | null;
    photo_url: string | null;
    is_deceased: boolean;
  }[];
  father: { member_id: string; full_name: string; full_name_en: string | null } | null;
}

export default async function FamilyCardPage({
  params,
}: {
  params: Promise<{ member_id: string }>;
}) {
  const { member_id } = await params;
  const supabase = await createClient();

  // Single RPC replaces the 6–7 sequential round-trips
  const [cardResult, userResult] = await Promise.all([
    supabase.rpc("get_family_card", { p_member_id: member_id }),
    supabase.auth.getUser(), // still needed for userId + userFamilyId (photo uploads / edit_history)
  ]);

  const data = cardResult.data as FamilyCardRpc | null;
  if (!data || !data.found) notFound();

  const userId = userResult.data.user?.id ?? null;

  // userFamilyId — needed for photo upload paths; only fetch when user can edit
  let userFamilyId: string | null = null;
  if (userId && data.can_edit) {
    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("auth_user_id", userId)
      .single();
    if (family) userFamilyId = family.id;
  }

  return (
    <FamilyCardClient
      member={data.member}
      spouses={data.spouses || []}
      childrenData={data.children || []}
      father={data.father ? { ...data.father, is_deceased: false } : null}
      memberChildren={data.member_children || []}
      canEdit={data.can_edit}
      userFamilyId={userFamilyId}
      userId={userId}
      isOwnCard={data.is_own_card}
    />
  );
}
