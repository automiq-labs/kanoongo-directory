import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Write one client-side `edit_history` row (the S9 pattern: the client records
 * history itself after a successful update, because the plain table updates and
 * some RPCs write none server-side).
 *
 * `previous_values` carries a `_fields` key alongside the snapshot: the raw
 * column names actually changed in this save. The activity feed reads it to
 * show WHAT changed — without it, the snapshot alone can't distinguish a
 * changed column from an untouched one. Sibling of the `_note` convention used
 * by Lane-1 manual data fixes; both are underscore-prefixed so readers can tell
 * metadata from real column snapshots.
 *
 * Best-effort by design: history must never fail a save that already
 * succeeded, so errors are warned and swallowed.
 *
 * Note the RLS contract on edit_history: `changed_by` must equal auth.uid(),
 * and `family_id` must match the caller's own family unless they are an admin.
 */
export async function logEditHistory(
  supabase: SupabaseClient,
  entry: {
    table: string;
    recordId: string;
    /** The record's family. Required for non-admin callers; admins may pass null. */
    familyId: string | null;
    userId: string | null;
    /** Previous state — a full row snapshot, or just the changed keys. */
    previous: Record<string, unknown>;
    /** Raw column names changed in this save. */
    fields: string[];
  },
): Promise<void> {
  if (!entry.userId || entry.fields.length === 0) return;

  const { error } = await supabase.from("edit_history").insert({
    table_name: entry.table,
    record_id: entry.recordId,
    family_id: entry.familyId,
    changed_by: entry.userId,
    previous_values: { ...entry.previous, _fields: entry.fields },
  });

  if (error) console.warn(`edit_history (${entry.table}) insert failed:`, error.message);
}
