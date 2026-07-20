import { createClient } from "@/lib/supabase/server";
import { Member } from "@/lib/types";
import DirectoryClient from "./directory-client";

export default async function DirectoryPage() {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("members")
    .select(
      "member_id, full_name, full_name_en, city, city_en, gotra, gotra_en, is_deceased, photo_url, gender, dob, marital_status, sort_seq"
    )
    .order("sort_seq");

  return <DirectoryClient members={(members as Member[]) || []} />;
}
