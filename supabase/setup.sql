-- ════════════════════════════════════════════════════════════════════
--  Drug Disco Lab — presence system database (Supabase / PostgreSQL)
--
--  HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
--  whole file → Run. Safe to run again later (it updates the functions
--  and keeps your data).
--
--  Security model
--   • The tables are locked: the website can NOT read or change them directly.
--   • The website only calls the functions below. Every action that changes
--     something checks the member's PIN (or an admin session) inside the
--     database, so the public key on the website is harmless on its own.
--   • PINs are stored as bcrypt hashes. 5 wrong PINs → locked for 30 s.
--   • "Today" means today in Bangkok time.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── tables ───────────────────────────────────────────────────────────
create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  nickname      text not null unique,
  initials      text not null,
  avatar        text,
  position      text not null,
  status        text not null default 'pending' check (status in ('pending', 'active', 'inactive')),
  is_admin      boolean not null default false,
  pin_hash      text not null,
  fail_count    int not null default 0,
  locked_until  timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.events (            -- every check-in / check-out, never deleted
  id             bigserial primary key,
  member_id      uuid not null references public.members(id) on delete cascade,
  type           text not null check (type in ('check_in', 'check_out')),
  ts             timestamptz not null default now(),
  feeling_emoji  text,
  feeling_text   text,
  auto           boolean not null default false        -- true = automatic midnight check-out
);
create index if not exists events_ts_idx on public.events (ts);

create table if not exists public.status (            -- live state, one row per member
  member_id       uuid primary key references public.members(id) on delete cascade,
  is_in           boolean not null default false,
  last_check_in   timestamptz,
  last_check_out  timestamptz,
  feeling_emoji   text,
  feeling_text    text
);

create table if not exists public.admin_sessions (
  token       uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  expires_at  timestamptz not null
);

-- lock every table: no direct access from the website at all
alter table public.members        enable row level security;
alter table public.events         enable row level security;
alter table public.status         enable row level security;
alter table public.admin_sessions enable row level security;
revoke all on public.members, public.events, public.status, public.admin_sessions from anon, authenticated;
revoke all on sequence public.events_id_seq from anon, authenticated;

-- ── internal helpers (not callable from the website) ─────────────────
create or replace function public._today_start() returns timestamptz
language sql stable as $$
  select date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'
$$;

-- anyone still "in" from an earlier day is checked out at 23:59:59 (Bangkok) that day
create or replace function public._housekeeping() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_end timestamptz;
begin
  for r in select * from status where is_in and last_check_in < _today_start() loop
    v_end := (date_trunc('day', r.last_check_in at time zone 'Asia/Bangkok') + interval '23 hours 59 minutes 59 seconds') at time zone 'Asia/Bangkok';
    insert into events (member_id, type, ts, auto) values (r.member_id, 'check_out', v_end, true);
    update status set is_in = false, last_check_out = v_end, feeling_emoji = null, feeling_text = null where member_id = r.member_id;
  end loop;
  delete from admin_sessions where expires_at < now();
end $$;

-- returns null when the PIN is right, otherwise an error message (and counts the failure)
create or replace function public._check_pin(p_id uuid, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare m members;
begin
  select * into m from members where id = p_id;
  if not found then return 'member not found'; end if;
  if m.locked_until is not null and m.locked_until > now() then
    return 'too many tries — wait ' || ceil(extract(epoch from m.locked_until - now()))::int || 's';
  end if;
  if crypt(coalesce(p_pin, ''), m.pin_hash) = m.pin_hash then
    update members set fail_count = 0, locked_until = null where id = p_id;
    return null;
  end if;
  if m.fail_count + 1 >= 5 then
    update members set fail_count = 0, locked_until = now() + interval '30 seconds' where id = p_id;
    return 'too many tries — locked for 30s';
  end if;
  update members set fail_count = m.fail_count + 1 where id = p_id;
  return 'wrong PIN (' || (4 - m.fail_count) || case when m.fail_count = 3 then ' try left)' else ' tries left)' end;
end $$;

-- PIN must be right AND the member approved & active
create or replace function public._check_member(p_id uuid, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare err text; st text;
begin
  err := _check_pin(p_id, p_pin);
  if err is not null then return err; end if;
  select status into st from members where id = p_id;
  if st = 'pending' then return 'waiting for admin approval'; end if;
  if st <> 'active' then return 'this account is inactive — ask an admin'; end if;
  return null;
end $$;

create or replace function public._admin(p_token uuid) returns uuid
language sql security definer set search_path = public, extensions as $$
  select s.member_id from admin_sessions s join members m on m.id = s.member_id
  where s.token = p_token and s.expires_at > now() and m.is_admin and m.status = 'active'
$$;

create or replace function public._clean_text(t text, n int) returns text
language sql immutable as $$ select nullif(left(btrim(coalesce(t, '')), n), '') $$;

create or replace function public._status_json(p_id uuid) returns jsonb
language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object('is_in', is_in, 'last_check_in', last_check_in, 'last_check_out', last_check_out,
                            'feeling_emoji', feeling_emoji, 'feeling_text', feeling_text)
  from status where member_id = p_id
$$;

-- shared validation for sign-up / first admin
create or replace function public._validate_new(p_full_name text, p_nickname text, p_initials text, p_position text, p_pin text, p_avatar text) returns text
language plpgsql set search_path = public, extensions as $$
begin
  if char_length(btrim(coalesce(p_full_name, ''))) < 2 then return 'please enter your full name'; end if;
  if p_nickname !~ '^[a-z0-9_-]{2,12}$' then return 'nickname: 2–12 letters, numbers, _ or -'; end if;
  if exists (select 1 from members where nickname = p_nickname) then return '"' || p_nickname || '" is already taken'; end if;
  if p_initials is null or char_length(p_initials) not between 1 and 3 or p_initials ~ '\s' then return 'initials: 1–3 letters, no spaces'; end if;
  if char_length(btrim(coalesce(p_position, ''))) not between 1 and 40 then return 'please choose your position'; end if;
  if p_pin !~ '^\d{6}$' then return 'PIN must be 6 digits'; end if;
  if p_avatar is not null and p_avatar !~ '^\d{1,2}(\.\d{1,2}){6}$' then return 'avatar code looks wrong'; end if;
  return null;
end $$;

-- ── public functions (what the website calls) ────────────────────────

-- everything the wall dashboard and the app's name list need
create or replace function public.board() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _housekeeping();
  return jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'nickname', nickname, 'initials', initials, 'avatar', avatar,
        'position', position, 'status', status, 'is_admin', is_admin) order by nickname)
      from members where status = 'active'), '[]'::jsonb),
    'status', coalesce((select jsonb_object_agg(s.member_id, _status_json(s.member_id))
      from status s join members m on m.id = s.member_id where m.status = 'active'), '{}'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
        'member_id', e.member_id, 'type', e.type, 'timestamp', e.ts,
        'feeling_emoji', e.feeling_emoji, 'feeling_text', e.feeling_text) order by e.ts)
      from events e join members m on m.id = e.member_id
      where e.ts >= _today_start() and m.status = 'active'), '[]'::jsonb),
    'setup_needed', not exists (select 1 from members));
end $$;

-- the very first admin (only works while there are no members at all)
create or replace function public.setup_first_admin(p_full_name text, p_nickname text, p_initials text, p_position text, p_pin text, p_avatar text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare err text; v_id uuid; v_nick text := lower(btrim(p_nickname)); v_ini text := upper(btrim(p_initials));
begin
  perform pg_advisory_xact_lock(424242);
  if exists (select 1 from members) then return jsonb_build_object('ok', false, 'error', 'setup is already done'); end if;
  err := _validate_new(p_full_name, v_nick, v_ini, p_position, p_pin, p_avatar);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  insert into members (full_name, nickname, initials, avatar, position, status, is_admin, pin_hash)
  values (btrim(p_full_name), v_nick, v_ini, p_avatar, btrim(p_position), 'active', true, crypt(p_pin, gen_salt('bf', 8)))
  returning id into v_id;
  insert into status (member_id) values (v_id);
  return jsonb_build_object('ok', true, 'id', v_id, 'nickname', v_nick);
end $$;

-- a new member asks to join (an admin must approve)
create or replace function public.sign_up(p_full_name text, p_nickname text, p_initials text, p_position text, p_pin text, p_avatar text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare err text; v_id uuid; v_nick text := lower(btrim(p_nickname)); v_ini text := upper(btrim(p_initials));
begin
  if (select count(*) from members where status = 'pending') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'too many waiting requests — ask an admin');
  end if;
  err := _validate_new(p_full_name, v_nick, v_ini, p_position, p_pin, p_avatar);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  insert into members (full_name, nickname, initials, avatar, position, pin_hash)
  values (btrim(p_full_name), v_nick, v_ini, p_avatar, btrim(p_position), crypt(p_pin, gen_salt('bf', 8)))
  returning id into v_id;
  insert into status (member_id) values (v_id);
  return jsonb_build_object('ok', true, 'id', v_id, 'nickname', v_nick);
end $$;

create or replace function public.verify(p_id uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare err text;
begin
  err := _check_member(p_id, p_pin);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.check_in(p_id uuid, p_pin text, p_emoji text default null, p_text text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare err text; v_e text := _clean_text(p_emoji, 16); v_t text := _clean_text(p_text, 40);
begin
  perform _housekeeping();
  err := _check_member(p_id, p_pin);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  if (select is_in from status where member_id = p_id) then return jsonb_build_object('ok', false, 'error', 'already checked in'); end if;
  insert into events (member_id, type, feeling_emoji, feeling_text) values (p_id, 'check_in', v_e, v_t);
  update status set is_in = true, last_check_in = now(), feeling_emoji = v_e, feeling_text = v_t where member_id = p_id;
  return jsonb_build_object('ok', true, 'status', _status_json(p_id));
end $$;

create or replace function public.check_out(p_id uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare err text;
begin
  perform _housekeeping();
  err := _check_member(p_id, p_pin);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  if not (select is_in from status where member_id = p_id) then return jsonb_build_object('ok', false, 'error', 'not checked in'); end if;
  insert into events (member_id, type) values (p_id, 'check_out');
  update status set is_in = false, last_check_out = now(), feeling_emoji = null, feeling_text = null where member_id = p_id;
  return jsonb_build_object('ok', true, 'status', _status_json(p_id));
end $$;

-- change mood without checking out (status only, not an event)
create or replace function public.set_feeling(p_id uuid, p_pin text, p_emoji text default null, p_text text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare err text;
begin
  err := _check_member(p_id, p_pin);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  if not (select is_in from status where member_id = p_id) then return jsonb_build_object('ok', false, 'error', 'check in first'); end if;
  update status set feeling_emoji = _clean_text(p_emoji, 16), feeling_text = _clean_text(p_text, 40) where member_id = p_id;
  return jsonb_build_object('ok', true, 'status', _status_json(p_id));
end $$;

create or replace function public.set_profile(p_id uuid, p_pin text, p_initials text, p_avatar text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare err text; v_ini text := upper(btrim(coalesce(p_initials, '')));
begin
  err := _check_member(p_id, p_pin);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  if char_length(v_ini) not between 1 and 3 or v_ini ~ '\s' then return jsonb_build_object('ok', false, 'error', 'initials: 1–3 letters, no spaces'); end if;
  if p_avatar is not null and p_avatar !~ '^\d{1,2}(\.\d{1,2}){6}$' then return jsonb_build_object('ok', false, 'error', 'avatar code looks wrong'); end if;
  update members set initials = v_ini, avatar = p_avatar where id = p_id;
  return jsonb_build_object('ok', true, 'initials', v_ini, 'avatar', p_avatar);
end $$;

create or replace function public.change_pin(p_id uuid, p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare err text;
begin
  err := _check_pin(p_id, p_old);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  if p_new !~ '^\d{6}$' then return jsonb_build_object('ok', false, 'error', 'PIN must be 6 digits'); end if;
  update members set pin_hash = crypt(p_new, gen_salt('bf', 8)) where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ── admin ────────────────────────────────────────────────────────────
create or replace function public.admin_login(p_id uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare err text; v_tok uuid; m members;
begin
  err := _check_member(p_id, p_pin);
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  select * into m from members where id = p_id;
  if not m.is_admin then return jsonb_build_object('ok', false, 'error', 'not an admin'); end if;
  insert into admin_sessions (member_id, expires_at) values (p_id, now() + interval '2 hours') returning token into v_tok;
  return jsonb_build_object('ok', true, 'id', p_id, 'nickname', m.nickname, 'key', v_tok);
end $$;

create or replace function public.admin_members(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if _admin(p_token) is null then return jsonb_build_object('ok', false, 'error', 'please log in as admin again'); end if;
  return jsonb_build_object('ok', true, 'members', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'full_name', m.full_name, 'nickname', m.nickname, 'initials', m.initials, 'avatar', m.avatar,
      'position', m.position, 'status', m.status, 'is_admin', m.is_admin, 'created_at', m.created_at,
      'state', _status_json(m.id)) order by m.nickname) from members m), '[]'::jsonb));
end $$;

create or replace function public.admin_approve(p_token uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if _admin(p_token) is null then return jsonb_build_object('ok', false, 'error', 'please log in as admin again'); end if;
  update members set status = 'active' where id = p_id and status = 'pending';
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_reject(p_token uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if _admin(p_token) is null then return jsonb_build_object('ok', false, 'error', 'please log in as admin again'); end if;
  delete from members where id = p_id and status = 'pending';
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_force_checkout(p_token uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if _admin(p_token) is null then return jsonb_build_object('ok', false, 'error', 'please log in as admin again'); end if;
  if (select is_in from status where member_id = p_id) then
    insert into events (member_id, type) values (p_id, 'check_out');
    update status set is_in = false, last_check_out = now(), feeling_emoji = null, feeling_text = null where member_id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_set_active(p_token uuid, p_id uuid, p_active boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := _admin(p_token);
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'please log in as admin again'); end if;
  if me = p_id and not p_active then return jsonb_build_object('ok', false, 'error', 'you can''t deactivate yourself'); end if;
  if not p_active then perform admin_force_checkout(p_token, p_id); end if;
  update members set status = case when p_active then 'active' else 'inactive' end where id = p_id and status <> 'pending';
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_set_admin(p_token uuid, p_id uuid, p_admin boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := _admin(p_token);
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'please log in as admin again'); end if;
  if me = p_id and not p_admin then return jsonb_build_object('ok', false, 'error', 'you can''t remove your own admin rights'); end if;
  update members set is_admin = p_admin where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- gives the member a new random PIN, shown once to the admin
create or replace function public.admin_reset_pin(p_token uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_pin text := lpad((floor(random() * 1000000))::int::text, 6, '0');
begin
  if _admin(p_token) is null then return jsonb_build_object('ok', false, 'error', 'please log in as admin again'); end if;
  update members set pin_hash = crypt(v_pin, gen_salt('bf', 8)), fail_count = 0, locked_until = null where id = p_id;
  return jsonb_build_object('ok', true, 'pin', v_pin);
end $$;

-- ── who may call what ────────────────────────────────────────────────
-- helpers: nobody from outside
revoke execute on function public._today_start(), public._housekeeping(), public._check_pin(uuid, text),
  public._check_member(uuid, text), public._admin(uuid), public._clean_text(text, int), public._status_json(uuid),
  public._validate_new(text, text, text, text, text, text)
  from public, anon, authenticated;
-- the website (anon / publishable key): only these
grant execute on function public.board(), public.setup_first_admin(text, text, text, text, text, text),
  public.sign_up(text, text, text, text, text, text), public.verify(uuid, text),
  public.check_in(uuid, text, text, text), public.check_out(uuid, text), public.set_feeling(uuid, text, text, text),
  public.set_profile(uuid, text, text, text), public.change_pin(uuid, text, text),
  public.admin_login(uuid, text), public.admin_members(uuid), public.admin_approve(uuid, uuid),
  public.admin_reject(uuid, uuid), public.admin_force_checkout(uuid, uuid), public.admin_set_active(uuid, uuid, boolean),
  public.admin_set_admin(uuid, uuid, boolean), public.admin_reset_pin(uuid, uuid)
  to anon, authenticated;
