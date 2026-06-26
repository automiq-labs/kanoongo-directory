import { createClient } from "@/lib/supabase/server";
import { Member, Spouse, Child } from "@/lib/types";
import { notFound } from "next/navigation";
import FamilyCardClient from "./family-card-client";

export default async function FamilyCardPage({
  params,
}: {
  params: Promise<{ member_id: string }>;
}) {
  const { member_id } = await params;
  const supabase = await createClient();

  // Fetch member + current user + branch edit permission in parallel
  const [memberResult, userResult, canEditResult] = await Promise.all([
    supabase.from("members").select("*").eq("member_id", member_id).single(),
    supabase.auth.getUser(),
    supabase.rpc("can_edit_member", { p_member_id: member_id }),
  ]);

  if (!memberResult.data) notFound();
  const m = memberResult.data as Member;
  const userId = userResult.data.user?.id ?? null;
  const canEdit = canEditResult.data === true;

  // Look up user's family_id (needed for photo upload paths)
  let userFamilyId: string | null = null;
  if (userId && canEdit) {
    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("auth_user_id", userId)
      .single();
    if (family) userFamilyId = family.id;
  }

  // Determine if this is the user's own card
  let isOwnCard = false;
  if (userId) {
    const { data: ownFam } = await supabase
      .from("families")
      .select("head_member_id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    isOwnCard = ownFam?.head_member_id === member_id;
  }

  const [spouseResult, childrenResult, fatherResult, memberChildrenResult] =
    await Promise.all([
      supabase.from("spouses").select("*").eq("member_id", member_id),
      supabase.from("children").select("*").eq("parent_member_id", member_id),
      m.father_member_id
        ? supabase
            .from("members")
            .select("member_id, full_name, full_name_en, is_deceased")
            .eq("member_id", m.father_member_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("members")
        .select("member_id, full_name, full_name_en, is_deceased")
        .eq("father_member_id", member_id),
    ]);

  const spouses = (spouseResult.data as Spouse[]) || [];
  const children = (childrenResult.data as Child[]) || [];
  const father = fatherResult.data as Pick<
    Member,
    "member_id" | "full_name" | "full_name_en" | "is_deceased"
  > | null;
  const memberChildren =
    (memberChildrenResult.data as Pick<
      Member,
      "member_id" | "full_name" | "full_name_en" | "is_deceased"
    >[]) || [];

  return (
    <FamilyCardClient
      member={m}
      spouses={spouses}
      childrenData={children}
      father={father}
      memberChildren={memberChildren}
      canEdit={canEdit}
      userFamilyId={userFamilyId}
      userId={userId}
      isOwnCard={isOwnCard}
    />
  );
}
