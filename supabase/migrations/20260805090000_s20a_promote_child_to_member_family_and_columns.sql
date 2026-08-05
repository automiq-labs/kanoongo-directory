-- ═══════════════════════════════════════════════════════════════════════════
-- S20 Batch A — promote_child_to_member(): family row, kept columns,
--               caller-controlled marital status, serialised N-ids
-- ═══════════════════════════════════════════════════════════════════════════
--
-- BUG 1 (orphaning). Both branches inserted members.family_id = null and never
-- created a families row, so every promotion produced a member outside the
-- strictly 1:1 family model (216 members / 216 families / 216 distinct heads).
-- Four live rows were affected — D0048_1, N0006, N0007, N0008 — and Lane 1
-- backfilled them in S20 under snapshot 29. The data is correct; this makes the
-- function stop re-breaking it on the next promotion.
--
-- Fix mirrors what complete_registration() already does for a null-family claim
-- target: insert the member, insert the family, point the member at it.
-- auth_user_id stays NULL — a promotion is not a claim, and leaving it null
-- keeps the row claimable later through the normal registration path.
--
-- BUG 2 (column loss). children carries mobile, email, occupation,
-- occupation_en, notes and notes_en; the function copied none of them. A child
-- with a phone number and an occupation lost both on promotion. Now carried
-- across (mobile → members.mobile_1).
--
-- BUG 3 (marital status). Both branches hardcoded marital_status='married'.
-- That is correct for the family card's "Mark as married" button, which is what
-- promotion means there — but the admin portal's "Promote to Member" button
-- carries no marriage language and was silently marking adult unmarried sons as
-- married. Now caller-controlled via p_mark_married, defaulting to true so every
-- existing caller keeps today's behaviour.
--   * son branch      — honours p_mark_married; when false, falls through to
--                       coalesce(v_child.marital_status,'unmarried')
--   * daughter branch — unconditionally 'married', deliberately unchanged: a
--                       D-id IS a married daughter, the branch takes
--                       p_husband_name and sets edit_blocked
--
-- BUG 4 (id race). N-id generation had no advisory lock, unlike the identical
-- block in complete_registration, so two concurrent promotions could compute
-- the same N-id. Same lock key, copied verbatim.
--
-- DELIBERATELY UNCHANGED: D-id / N-id generation itself, edit_blocked = true on
-- the daughter branch (S12), SECURITY DEFINER, search_path = public.
--
-- NOT CARRIED: children.gender_confirmed has no members counterpart.
--
-- SIGNATURE CHANGE: gains p_mark_married boolean default true (4 args, was 3).
-- A defaulted trailing parameter cannot be added with CREATE OR REPLACE — that
-- creates an overload and makes the PostgREST call ambiguous — so the old
-- signature is dropped first. Existing 3-argument callers keep working.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.promote_child_to_member(text, text, text);

create or replace function public.promote_child_to_member(
  p_child_id text,
  p_husband_name text default null,
  p_husband_name_en text default null,
  p_mark_married boolean default true
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_child   public.children%rowtype;
  v_parent  text;
  v_is_daughter boolean;
  v_base text;
  v_seq int;
  v_new_id text;
  v_family_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_child from public.children where child_id = p_child_id;
  if not found then raise exception 'Child % not found', p_child_id; end if;

  v_parent := v_child.parent_member_id;

  if not public.can_edit_member(v_parent) then
    raise exception 'Not permitted to edit this branch';
  end if;

  v_is_daughter := (lower(coalesce(v_child.gender,'')) in ('f','female'));

  if v_is_daughter then
    -- ── D-id generation (unchanged) ──────────────────────────────────────
    if v_parent ~ '^M[0-9]+$' then
      v_base := substring(v_parent from 2);
    else
      v_base := regexp_replace(v_parent, '[^0-9A-Za-z]', '', 'g');
    end if;
    select coalesce(max(
             (split_part(member_id, '_', array_length(string_to_array(member_id,'_'),1)))::int
           ), 0) + 1
      into v_seq
      from public.members
      where member_id like 'D' || v_base || '\_%';
    v_new_id := 'D' || v_base || '_' || v_seq::text;

    -- marital_status stays unconditionally 'married' here: a D-id is by
    -- definition a married daughter.
    insert into public.members (member_id, family_id, full_name, full_name_en, gender,
      father_member_id, education, education_en, dob, marital_status,
      husband_name, husband_name_en, photo_url, origin, edit_blocked,
      mobile_1, email, occupation, occupation_en, notes, notes_en)
    values (v_new_id, null, v_child.full_name, v_child.full_name_en, 'F',
      v_parent, v_child.education, v_child.education_en, v_child.dob, 'married',
      p_husband_name, p_husband_name_en, v_child.photo_url, 'self_registered',
      true,  -- S12: married daughters edit-blocked by default
      v_child.mobile, v_child.email, v_child.occupation, v_child.occupation_en,
      v_child.notes, v_child.notes_en);
  else
    -- ── N-id generation (unchanged, now serialised as complete_registration does) ──
    perform pg_advisory_xact_lock(hashtext('kanoongo_member_id_seq'));
    select coalesce(max(substring(member_id from 2)::int), 0) + 1
      into v_seq
      from public.members where member_id ~ '^N[0-9]+$';
    v_new_id := 'N' || lpad(v_seq::text, 4, '0');

    insert into public.members (member_id, family_id, full_name, full_name_en, gender,
      father_member_id, education, education_en, dob, marital_status, photo_url, origin,
      mobile_1, email, occupation, occupation_en, notes, notes_en)
    values (v_new_id, null, v_child.full_name, v_child.full_name_en,
      coalesce(v_child.gender,'M'),
      v_parent, v_child.education, v_child.education_en, v_child.dob,
      case when coalesce(p_mark_married, true) then 'married'
           else coalesce(v_child.marital_status, 'unmarried') end,
      v_child.photo_url, 'self_registered',
      v_child.mobile, v_child.email, v_child.occupation, v_child.occupation_en,
      v_child.notes, v_child.notes_en);
  end if;

  -- ── S20: the promoted member gets its own family row ───────────────────
  -- Ordering matters: families.head_member_id references members(member_id),
  -- so the member must exist first, exactly as complete_registration does it.
  insert into public.families (auth_user_id, head_member_id, family_label, status)
  values (null, v_new_id, v_child.full_name, 'active')
  returning id into v_family_id;

  update public.members set family_id = v_family_id where member_id = v_new_id;

  delete from public.children where child_id = p_child_id;

  return v_new_id;
end;
$function$;

-- ── Grants: re-stated verbatim as they stood before the DROP ───────────────
-- Pre-migration ACL: postgres=X/postgres | authenticated=X/postgres |
-- service_role=X/postgres — no PUBLIC, no anon. DROP discards the ACL, so these
-- GRANTs are load-bearing, not cosmetic.
revoke all on function public.promote_child_to_member(text, text, text, boolean) from public;
grant execute on function public.promote_child_to_member(text, text, text, boolean) to authenticated;
grant execute on function public.promote_child_to_member(text, text, text, boolean) to service_role;

notify pgrst, 'reload schema';
