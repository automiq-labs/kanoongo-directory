-- S20 correction. The three S20 migrations revoked EXECUTE from PUBLIC, but
-- Supabase's default privileges on schema public grant EXECUTE on newly created
-- functions to anon/authenticated/service_role as explicit role grants. REVOKE
-- ... FROM public does not remove a role grant, so each DROP+CREATE silently
-- re-added anon. Pre-migration ACLs (read from pg_proc.proacl before the batch)
-- had no anon on these four. Restoring that exactly.
--
-- Impact was limited, not nil: both rewritten functions raise 'Not authenticated'
-- when auth.uid() is null, so an anonymous caller could not have completed a
-- registration or a promotion. This closes the surface anyway.
--
-- The two pre-auth pickers (search_parent_fuzzy, find_matching_children) KEEP
-- anon deliberately — they run before the user has a session.

revoke execute on function public.complete_registration(text, text, text, text, text, text, boolean) from anon;
revoke execute on function public.promote_child_to_member(text, text, text, boolean) from anon;
revoke execute on function public.normalize_person_name(text) from anon;
revoke execute on function public.name_given_part(text) from anon;

notify pgrst, 'reload schema';
