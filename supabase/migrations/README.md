# Migrations

## This directory is not the full schema history

Production has 71 applied migrations; the files here start at S20 (2026-08-05).
Everything earlier was applied directly against the database and never committed.
`supabase_migrations.schema_migrations` in the project is the source of truth.

Practical consequence: `supabase db push` against the **live** database is fine —
version numbers here match what is recorded there. `supabase db reset`, or a push
against a **fresh** database, will NOT reproduce production.

## Filenames must match the applied version

The version prefix is what the CLI compares against
`supabase_migrations.schema_migrations.version`. If a migration is applied by
hand (Supabase MCP, dashboard SQL editor), read the version it was recorded
under and rename the file to match, or the CLI will keep offering to re-apply it.

## Always revoke anon explicitly when a migration creates a function

`REVOKE ALL ON FUNCTION ... FROM public` does **not** remove anon's EXECUTE.
Supabase's default privileges on schema `public` grant EXECUTE on newly created
functions to `anon`, `authenticated` and `service_role` as *explicit role
grants*, and a revoke aimed at the `PUBLIC` pseudo-role leaves those untouched.

So every `CREATE FUNCTION` — including the CREATE half of a DROP+CREATE, which
resets the ACL — silently hands anon EXECUTE unless you write:

```sql
revoke execute on function public.your_function(argtypes) from anon;
```

Grant anon back only where it is genuinely wanted (the pre-auth register
pickers, `search_parent_fuzzy` and `find_matching_children`).

This project has hit this twice: `20260702115713_revoke_anon_rpc_hardening`
(July, applied but not committed) and `20260805120335_s20c_...` (S20).
