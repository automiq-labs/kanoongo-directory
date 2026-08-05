-- ═══════════════════════════════════════════════════════════════════════════
-- S20 Batch B — registration dedup guard: honorific- and spelling-tolerant
-- ═══════════════════════════════════════════════════════════════════════════
--
-- complete_registration()'s "brand-new member" branch guarded against
-- duplicates with exact string equality (btrim/lower) scoped to the chosen
-- parent. That is why four duplicate uncle registrations got through in S18:
-- every one differed from the register row only by an honorific or a spelling
-- variant. This widens the comparison without widening its scope.
--
-- Two failure modes, deliberately distinguishable:
--   exact normalised match  → name_matches_existing_child / _member   (hard)
--   fuzzy given-name match  → name_probably_matches_existing_child /
--                             _member, suffixed with the candidate id  (soft)
-- The soft error carries the candidate so the UI can offer a claim instead of a
-- dead end. p_force_new = true is the "No, I'm someone else" escape: it
-- bypasses ONLY the fuzzy checks. An exact normalised match stays a hard error
-- under every circumstance.
--
-- This guard prevents NEW duplicates. It never merges, updates or soft-deletes
-- an existing row — merges are Lane-1 work, by hand, under a snapshot.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Normalisation helper ────────────────────────────────────────────────
--
-- ANCHORING IS THE WHOLE POINT. A global strip corrupts real names: राजीव ends
-- in जी, श्रीराम starts with श्री, स्वेता starts with स्व. So:
--   * honorifics are stripped from the START only, and must be followed by
--     whitespace — which is what saves श्रीराम / Shriram;
--   * the abbreviated स्व form requires its punctuation (: or .) — which is
--     what saves स्वेता, and still catches the live "स्व:गोविन्द" that runs
--     straight into the name with no space;
--   * जी / ji are stripped from the END only, and must be preceded by
--     whitespace — which is what saves राजीव, and leaves the interior जी in
--     "गोविन्द नारायण जी कानूनगो" untouched.
-- The assertions below are not decoration; Lane 1 hit exactly this bug in S19.

create or replace function public.normalize_person_name(p_name text)
returns text
language sql
immutable
parallel safe
set search_path to 'public'
as $function$
  select nullif(btrim(
    regexp_replace(                                  -- 3. collapse whitespace
      regexp_replace(                                -- 2. trailing जी / ji
        regexp_replace(                              -- 1. leading honorifics
          lower(btrim(coalesce(p_name, ''))),
          '^(?:(?:स्वर्गीया|स्वर्गीय|श्रीमती|श्री|कुमारी|late|shree|shri|smt|dr|kumari)\.?\s+|स्व\s*[:.]\s*)+',
          '', 'g'),
        '(?:\s+(?:जी|ji)\.?)+$', '', 'g'),
      '\s+', ' ', 'g')
  ), '');
$function$;

comment on function public.normalize_person_name(text) is
  'Strips leading honorifics and trailing जी/ji for duplicate detection. '
  'Anchored and whitespace-required so real names (राजीव, श्रीराम, स्वेता) survive intact.';

revoke all on function public.normalize_person_name(text) from public;
grant execute on function public.normalize_person_name(text) to authenticated;
grant execute on function public.normalize_person_name(text) to service_role;


-- ── 1b. Given-name part: the normalised name minus its surname ─────────────
--
-- The fuzzy comparison runs on THIS, not on the whole normalised string.
-- Measured against the live register (all same-parent pairs, threshold 0.55):
--
--   whole string   25 sibling pairs flagged   ← unshippable
--   minus surname   1 sibling pair flagged
--   first token     0 sibling pairs flagged
--
-- Trigram similarity over a full name is dominated by the shared surname and
-- middle name, so brothers score high on tokens they were always going to
-- share: "ramesh chandra kanoongo" vs "umesh chandra kanoongo" = 0.741.
--
-- Minus-surname is chosen over first-token because first-token loses the
-- tokenisation variants, which are precisely the S18 duplicate-uncle failure
-- mode — one register writes "Ram Ratan", the other "Ramratan":
--
--   pair                                        minus-surname   first-token
--   ram ratan / ramratan                        0.700 caught    0.300 MISSED
--   satya prakash / satyaprakash                0.688 caught    0.357 MISSED
--   kamal kishore / kamal kishor                0.786 caught    1.000 caught
--   brajesh kanoongo / brajesh kanungo          1.000 caught    1.000 caught
--
-- A single-token name has no surname to strip and is returned whole, so
-- "brajesh" still matches "brajesh kanoongo" (1.000).
create or replace function public.name_given_part(p_name text)
returns text
language sql
immutable
parallel safe
set search_path to 'public'
as $function$
  select case
           when n is null      then null
           when n ~ '\s'       then regexp_replace(n, '\s+\S+$', '')
           else n
         end
  from (select public.normalize_person_name(p_name) as n) s;
$function$;

comment on function public.name_given_part(text) is
  'Normalised name with the trailing surname token removed, for fuzzy duplicate '
  'detection. Comparing full names lets a shared surname carry siblings over the '
  'threshold; single-token names are returned unchanged.';

revoke all on function public.name_given_part(text) from public;
grant execute on function public.name_given_part(text) to authenticated;
grant execute on function public.name_given_part(text) to service_role;


-- ── 2. Assertions — the migration fails loudly if normalisation regresses ──
do $assert$
declare
  v_cases text[][] := array[
    -- must be left ALONE (the S19 trap cases)
    ['राजीव',                          'राजीव'],
    ['राजीव कानूनगो',                  'राजीव कानूनगो'],
    ['श्रीराम',                        'श्रीराम'],
    ['श्रीराम गुप्ता',                  'श्रीराम गुप्ता'],
    ['स्वेता',                         'स्वेता'],
    ['Shriram Kanoongo',              'shriram kanoongo'],
    -- must be stripped
    ['स्वर्गीय श्री कमल किशोर कानूनगो',    'कमल किशोर कानूनगो'],
    ['स्वर्गीया श्रीमती बसन्त देवी',       'बसन्त देवी'],
    ['स्व:गोविन्द नारायण जी कानूनगो',     'गोविन्द नारायण जी कानूनगो'],
    ['स्व: राम प्रसाद',                 'राम प्रसाद'],
    ['LATE श्री कृष्ण मोहन गुप्ता',       'कृष्ण मोहन गुप्ता'],
    ['Late Smt. Basant Devi Gupta',   'basant devi gupta'],
    ['Shri Ram Ratan Kanoongo',       'ram ratan kanoongo'],
    ['कुमारी निधि गुप्ता',               'निधि गुप्ता'],
    ['गोविन्द जी',                      'गोविन्द'],
    ['Govind ji',                     'govind'],
    ['  श्री  ब्रजेश   कानूनगो  ',        'ब्रजेश कानूनगो']
  ];
  v_i int;
  v_got text;
begin
  for v_i in 1 .. array_length(v_cases, 1) loop
    v_got := public.normalize_person_name(v_cases[v_i][1]);
    if v_got is distinct from v_cases[v_i][2] then
      raise exception 'normalize_person_name(%) = %, expected %',
        v_cases[v_i][1], coalesce(v_got, '<null>'), v_cases[v_i][2];
    end if;
  end loop;

  if public.normalize_person_name(null) is not null
     or public.normalize_person_name('   ') is not null then
    raise exception 'normalize_person_name should return null for null/blank input';
  end if;

  -- name_given_part: surname stripped, single-token names left whole
  if public.name_given_part('Shri Ram Ratan Kanoongo') is distinct from 'ram ratan' then
    raise exception 'name_given_part should drop the surname token';
  end if;
  if public.name_given_part('Brajesh') is distinct from 'brajesh' then
    raise exception 'name_given_part should leave a single-token name whole';
  end if;
  if public.name_given_part(null) is not null then
    raise exception 'name_given_part should return null for null input';
  end if;
  -- The properties the surname strip exists for. NOTE: ramesh/umesh "chandra"
  -- deliberately has no assertion — it still scores 0.611 and is the one
  -- residual false positive documented above, not a regression.
  if similarity(public.name_given_part('Asha Khandelwal'),
                public.name_given_part('Ashok Khandelwal')) > 0.55 then
    raise exception 'distinct siblings (asha/ashok) should no longer clear the threshold';
  end if;
  if similarity(public.name_given_part('Ram Ratan Kanoongo'),
                public.name_given_part('Ramratan Kanoongo')) <= 0.55 then
    raise exception 'tokenisation variants (the S18 failure mode) must still be caught';
  end if;
end
$assert$;


-- ── 3. complete_registration: widened guards + explicit override ───────────
--
-- SIGNATURE CHANGE: gains p_force_new boolean default false (7 args, was 6).
-- A defaulted trailing parameter cannot be added with CREATE OR REPLACE — that
-- creates an overload and makes the PostgREST call ambiguous — so the old
-- signature is dropped first. Existing 6-argument callers keep working.
drop function if exists public.complete_registration(text, text, text, text, text, text);

create or replace function public.complete_registration(
  p_name text,
  p_name_en text,
  p_parent_member_id text,
  p_claim_member_id text default null,
  p_claim_spouse_id text default null,
  p_invite_code text default null,
  p_force_new boolean default false
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_member_id text;
  v_family_id uuid;
  v_seq int;
  v_is_member boolean;
  v_is_child boolean;
  v_child public.children%rowtype;
  v_husband_member_id text;
  v_norm_hi text;
  v_norm_en text;
  v_given_en text;
  v_dup_id text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- SERVER-SIDE GATE (S9): invite code is enforced here, not just in the UI
  if not public.validate_invite_code(p_invite_code) then
    raise exception 'invalid_invite_code';
  end if;

  -- Already registered? (head slot)
  select id into v_family_id from public.families where auth_user_id = v_uid limit 1;
  if v_family_id is not null then
    select head_member_id into v_member_id from public.families where id = v_family_id;
    return v_member_id;
  end if;
  -- Already registered? (additional login slot)
  select fl.person_id into v_member_id from public.family_logins fl where fl.auth_user_id = v_uid limit 1;
  if v_member_id is not null then
    return v_member_id;
  end if;

  ----------------------------------------------------------------------
  -- SPOUSE CLAIM
  ----------------------------------------------------------------------
  if p_claim_spouse_id is not null then
    if exists (select 1 from public.family_logins fl
               where fl.person_kind='spouse' and fl.person_id=p_claim_spouse_id) then
      raise exception 'This record has already been claimed';
    end if;

    select s.member_id into v_husband_member_id
      from public.spouses s where s.spouse_id = p_claim_spouse_id;
    if v_husband_member_id is null then
      raise exception 'Spouse % not found', p_claim_spouse_id;
    end if;

    select family_id into v_family_id from public.members where member_id = v_husband_member_id;
    if v_family_id is null then
      insert into public.families (auth_user_id, head_member_id, family_label, status)
      values (null, v_husband_member_id, p_name, 'active')
      returning id into v_family_id;
      update public.members set family_id = v_family_id where member_id = v_husband_member_id;
    end if;

    insert into public.family_logins (family_id, auth_user_id, person_kind, person_id)
    values (v_family_id, v_uid, 'spouse', p_claim_spouse_id);

    return v_husband_member_id;
  end if;

  ----------------------------------------------------------------------
  -- MEMBER / CHILD CLAIM
  ----------------------------------------------------------------------
  if p_claim_member_id is not null then
    select exists(select 1 from public.members  where member_id = p_claim_member_id) into v_is_member;
    select exists(select 1 from public.children where child_id  = p_claim_member_id) into v_is_child;

    if v_is_member then
      perform 1 from public.members m
        join public.families f on f.id = m.family_id
        where m.member_id = p_claim_member_id and f.auth_user_id is not null;
      if found then
        raise exception 'This record has already been claimed';
      end if;

      select family_id into v_family_id from public.members where member_id = p_claim_member_id;
      if v_family_id is null then
        insert into public.families (auth_user_id, head_member_id, family_label, status)
        values (v_uid, p_claim_member_id, p_name, 'active')
        returning id into v_family_id;
        update public.members set family_id = v_family_id where member_id = p_claim_member_id;
      else
        update public.families
          set auth_user_id = v_uid,
              head_member_id = p_claim_member_id,
              family_label = coalesce(family_label, p_name)
          where id = v_family_id;
      end if;
      return p_claim_member_id;

    elsif v_is_child then
      select * into v_child from public.children where child_id = p_claim_member_id;

      -- S9: serialize N-id generation
      perform pg_advisory_xact_lock(hashtext('kanoongo_member_id_seq'));
      select coalesce(max(substring(member_id from 2)::int),0)+1 into v_seq
        from public.members where member_id ~ '^N[0-9]+$';
      v_member_id := 'N' || lpad(v_seq::text, 4, '0');

      insert into public.members
        (member_id, full_name, full_name_en, father_member_id, gender,
         dob, education, education_en, photo_url, origin, marital_status, notes, notes_en)
      values
        (v_member_id, v_child.full_name, v_child.full_name_en, v_child.parent_member_id, v_child.gender,
         v_child.dob, v_child.education, v_child.education_en, v_child.photo_url,
         'self_registered', coalesce(v_child.marital_status,'unmarried'), v_child.notes, v_child.notes_en);

      insert into public.families (auth_user_id, head_member_id, family_label, status)
      values (v_uid, v_member_id, p_name, 'active')
      returning id into v_family_id;

      update public.members set family_id = v_family_id where member_id = v_member_id;
      delete from public.children where child_id = p_claim_member_id;
      return v_member_id;

    else
      raise exception 'Claim target % not found as member or child', p_claim_member_id;
    end if;

  else
    -- brand-new member ("I'm not listed")

    ------------------------------------------------------------------
    -- S20 DEDUP GUARD (replaces the S12 exact-equality checks)
    -- Scope is unchanged: only the chosen parent's own children and
    -- unclaimed member-children are considered. A global scan would
    -- collide with the register's legitimate same-name pairs.
    ------------------------------------------------------------------
    v_norm_hi := public.normalize_person_name(p_name);
    v_norm_en := public.normalize_person_name(p_name_en);
    v_given_en := public.name_given_part(p_name_en);

    if p_parent_member_id is not null then

      -- (1) exact normalised match against a LIVE CHILD of the parent
      select c.child_id into v_dup_id
        from public.children c
       where c.parent_member_id = p_parent_member_id
         and c.removed_at is null
         and (
              (v_norm_en is not null and public.normalize_person_name(c.full_name_en) = v_norm_en)
           or (v_norm_hi is not null and public.normalize_person_name(c.full_name)    = v_norm_hi)
         )
       limit 1;
      if v_dup_id is not null then
        raise exception 'name_matches_existing_child';
      end if;

      -- (2) exact normalised match against an UNCLAIMED MEMBER under the parent
      --     (claimed members raise 'already been claimed' via the claim path)
      select m.member_id into v_dup_id
        from public.members m
        left join public.families f on f.id = m.family_id
       where m.father_member_id = p_parent_member_id
         and (f.id is null or f.auth_user_id is null)
         and (
              (v_norm_en is not null and public.normalize_person_name(m.full_name_en) = v_norm_en)
           or (v_norm_hi is not null and public.normalize_person_name(m.full_name)    = v_norm_hi)
         )
       limit 1;
      if v_dup_id is not null then
        raise exception 'name_matches_existing_member';
      end if;

      -- (3) + (4) fuzzy: probable duplicate. Soft — carries the candidate id so
      --     the UI can offer a claim. Skipped when the registrant has already
      --     said "No, I'm someone else".
      if not coalesce(p_force_new, false) and v_given_en is not null then

        select c.child_id into v_dup_id
          from public.children c
         where c.parent_member_id = p_parent_member_id
           and c.removed_at is null
           and public.name_given_part(c.full_name_en) is not null
           and similarity(public.name_given_part(c.full_name_en), v_given_en) > 0.55
         order by similarity(public.name_given_part(c.full_name_en), v_given_en) desc,
                  c.child_id
         limit 1;
        if v_dup_id is not null then
          raise exception 'name_probably_matches_existing_child:%', v_dup_id;
        end if;

        select m.member_id into v_dup_id
          from public.members m
          left join public.families f on f.id = m.family_id
         where m.father_member_id = p_parent_member_id
           and (f.id is null or f.auth_user_id is null)
           and public.name_given_part(m.full_name_en) is not null
           and similarity(public.name_given_part(m.full_name_en), v_given_en) > 0.55
         order by similarity(public.name_given_part(m.full_name_en), v_given_en) desc,
                  m.member_id
         limit 1;
        if v_dup_id is not null then
          raise exception 'name_probably_matches_existing_member:%', v_dup_id;
        end if;

      end if;
    end if;

    perform pg_advisory_xact_lock(hashtext('kanoongo_member_id_seq'));
    select coalesce(max(substring(member_id from 2)::int),0)+1 into v_seq
      from public.members where member_id ~ '^N[0-9]+$';
    v_member_id := 'N' || lpad(v_seq::text, 4, '0');

    insert into public.members (member_id, full_name, full_name_en, father_member_id, origin, marital_status)
    values (v_member_id, p_name, p_name_en, p_parent_member_id, 'self_registered', 'unmarried');

    insert into public.families (auth_user_id, head_member_id, family_label, status)
    values (v_uid, v_member_id, p_name, 'active')
    returning id into v_family_id;

    update public.members set family_id = v_family_id where member_id = v_member_id;
    return v_member_id;
  end if;
end;
$function$;

-- ── Grants: re-stated verbatim as they stood before the DROP ───────────────
-- Pre-migration ACL: postgres=X/postgres | authenticated=X/postgres |
-- service_role=X/postgres. No PUBLIC, no anon — registration requires a session.
-- DROP discards the ACL, so unlike Batch A these GRANTs are load-bearing.
revoke all on function public.complete_registration(text, text, text, text, text, text, boolean) from public;
grant execute on function public.complete_registration(text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.complete_registration(text, text, text, text, text, text, boolean) to service_role;

notify pgrst, 'reload schema';
