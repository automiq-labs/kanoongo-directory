-- ═══════════════════════════════════════════════════════════════════════════
-- S20 Batch B (lowest-priority item) — deceased status in the pre-auth pickers
-- ═══════════════════════════════════════════════════════════════════════════
--
-- From the S17 skip list: the register-flow pickers run before the user has a
-- session, so they cannot read members directly (RLS requires `authenticated`),
-- and neither RPC returned the status fields. An elder therefore appeared in
-- the parent picker with no स्वर्गीय while the same person carried the honorific
-- everywhere else in the app.
--
-- Both functions gain two columns — is_deceased and gender. gender is not
-- optional decoration: the Hindi honorific is gendered (स्वर्गीया for women),
-- so without it every deceased woman in the picker would read स्वर्गीय.
--
-- No new functions, no widened scope, no changed filters or ordering — only
-- two added output columns each. RETURNS TABLE cannot be altered in place, so
-- each is dropped and recreated; the anon grant is therefore load-bearing and
-- restated verbatim.
--
-- STILL OPEN: find_matching_spouses (the wife-claim picker) has the same gap
-- and would need spouses.date_of_death. Left alone — not in this batch's scope.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── search_parent_fuzzy: parent / husband picker ───────────────────────────
drop function if exists public.search_parent_fuzzy(text, text);

create or replace function public.search_parent_fuzzy(q text, p_invite_code text default null)
returns table(
  member_id text,
  full_name text,
  full_name_en text,
  city text,
  city_en text,
  match_score real,
  is_deceased boolean,
  gender text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select m.member_id, m.full_name, m.full_name_en, m.city, m.city_en,
    greatest(
      similarity(coalesce(m.full_name,''), q),
      similarity(coalesce(m.full_name_en,''), q)
    ) as match_score,
    m.is_deceased,
    m.gender
  from public.members m
  where (public.validate_invite_code(p_invite_code) or public.is_admin())
    and (
      m.full_name ilike '%'||q||'%'
      or m.full_name_en ilike '%'||q||'%'
      or similarity(coalesce(m.full_name,''), q) > 0.2
      or similarity(coalesce(m.full_name_en,''), q) > 0.2
    )
  order by match_score desc
  limit 25;
$function$;

revoke all on function public.search_parent_fuzzy(text, text) from public;
grant execute on function public.search_parent_fuzzy(text, text) to anon;
grant execute on function public.search_parent_fuzzy(text, text) to authenticated;
grant execute on function public.search_parent_fuzzy(text, text) to service_role;


-- ── find_matching_children: "is this you?" picker ──────────────────────────
drop function if exists public.find_matching_children(text, text, text);

create or replace function public.find_matching_children(
  p_parent_member_id text,
  q text,
  p_invite_code text default null
)
returns table(
  member_id text,
  full_name text,
  full_name_en text,
  city text,
  city_en text,
  marital_status text,
  already_claimed boolean,
  match_score real,
  source text,
  match_id text,
  is_deceased boolean,
  gender text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    m.member_id, m.full_name, m.full_name_en, m.city, m.city_en, m.marital_status,
    (f.auth_user_id is not null) as already_claimed,
    greatest(similarity(coalesce(m.full_name,''), q), similarity(coalesce(m.full_name_en,''), q)) as match_score,
    'member'::text as source, m.member_id as match_id,
    m.is_deceased, m.gender
  from public.members m
  left join public.families f on f.id = m.family_id
  where (public.validate_invite_code(p_invite_code) or public.is_admin())
    and m.father_member_id = p_parent_member_id
    and (
      m.full_name ilike '%'||q||'%' or m.full_name_en ilike '%'||q||'%'
      or similarity(coalesce(m.full_name,''), q) > 0.2
      or similarity(coalesce(m.full_name_en,''), q) > 0.2
    )
  union all
  select
    c.child_id, c.full_name, c.full_name_en, null::text, null::text, c.marital_status,
    false,
    greatest(similarity(coalesce(c.full_name,''), q), similarity(coalesce(c.full_name_en,''), q)),
    'child'::text, c.child_id,
    false,          -- children carry no deceased flag
    c.gender
  from public.children c
  where (public.validate_invite_code(p_invite_code) or public.is_admin())
    and c.parent_member_id = p_parent_member_id
    and (
      c.full_name ilike '%'||q||'%' or c.full_name_en ilike '%'||q||'%'
      or similarity(coalesce(c.full_name,''), q) > 0.2
      or similarity(coalesce(c.full_name_en,''), q) > 0.2
    )
  order by match_score desc
  limit 10;
$function$;

revoke all on function public.find_matching_children(text, text, text) from public;
grant execute on function public.find_matching_children(text, text, text) to anon;
grant execute on function public.find_matching_children(text, text, text) to authenticated;
grant execute on function public.find_matching_children(text, text, text) to service_role;

notify pgrst, 'reload schema';
