import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Soft-remove every still-live relative of a spouse.
 *
 * `delete_spouse` only touches the spouses row, so her spouse_relatives stayed
 * live and kept rendering on the family card. Call this right after a
 * successful `delete_spouse` so the branch disappears as a unit.
 *
 * Best-effort: each relative goes through the same `delete_spouse_relative`
 * RPC the Remove buttons use (so the same permission check and soft-delete
 * semantics apply). Failures are logged, never thrown — the spouse removal
 * itself has already succeeded by the time we get here.
 */
export async function removeSpouseRelatives(
  supabase: SupabaseClient,
  spouseId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("spouse_relatives")
    .select("relative_id")
    .eq("spouse_id", spouseId)
    .is("removed_at", null);

  if (error) {
    console.error("spouse relatives cascade — lookup failed:", error);
    return;
  }

  for (const row of (data as { relative_id: string }[] | null) ?? []) {
    const { error: rpcError } = await supabase.rpc("delete_spouse_relative", {
      p_relative_id: row.relative_id,
    });
    if (rpcError) console.error("delete_spouse_relative (cascade) failed:", rpcError);
  }
}
