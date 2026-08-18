-- S3 Builds — database schema
--
-- Paste into the Supabase SQL editor and run. Safe to re-run.
--
-- The shape here is the shape guide-load.js already reads and writes
-- against localStorage, so the adapter is a translation and not a redesign.
--
-- The important idea: every rule that MATTERS is enforced here, not in the
-- browser. A client-side check is a courtesy to honest users; anyone can
-- open the console and call the API directly with their own token. So one
-- vote per person is a primary key, not an if-statement, and "you may only
-- edit your own guide" is a row-level policy, not a hidden button.

-- ---------------------------------------------------------------- guides

create table if not exists public.guides (
  slug         text primary key,
  title        text not null check (length(title) between 1 and 200),
  blurb        text not null default '' check (length(blurb) <= 400),
  champ        text,
  role         text not null default 'Mid',
  tag          text not null default '' check (tag in ('', 'comp', 'fun', 'new')),

  -- The whole guide: items, runes, masteries, skill pages, prose. Kept as
  -- one document because it is always read and written whole, and because
  -- normalising a rune page into rows would buy nothing — nothing ever
  -- queries "which guides use this seal".
  body         jsonb not null default '{}'::jsonb,

  author_id    uuid not null references auth.users on delete cascade,
  author_name  text not null default '',

  -- Maintained by trigger from guide_votes. Never written by a client; see
  -- the column grant below, which is what actually stops that.
  votes        integer not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

create index if not exists guides_created_idx on public.guides (created_at desc);
create index if not exists guides_champ_idx   on public.guides (champ);
create index if not exists guides_votes_idx   on public.guides (votes desc);

-- ----------------------------------------------------------------- votes
--
-- One row per person per guide. The primary key is the rule: a second vote
-- from the same account is a constraint violation, not something the client
-- is trusted to prevent.

create table if not exists public.guide_votes (
  guide_slug text not null references public.guides on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guide_slug, user_id)
);

-- Keep guides.votes in step. Doing it in a trigger means the tally cannot
-- drift from the rows it counts, which it would if the client incremented.
create or replace function public.sync_vote_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.guides g
     set votes = (select count(*) from public.guide_votes v
                   where v.guide_slug = g.slug)
   where g.slug = coalesce(new.guide_slug, old.guide_slug);
  return null;
end $$;

drop trigger if exists guide_votes_sync on public.guide_votes;
create trigger guide_votes_sync
  after insert or delete on public.guide_votes
  for each row execute function public.sync_vote_count();

-- ------------------------------------------------------------------- RLS

alter table public.guides      enable row level security;
alter table public.guide_votes enable row level security;

-- Anyone may read. This is a public site; guides are the product.
drop policy if exists guides_read on public.guides;
create policy guides_read on public.guides for select using (true);

-- You may only create a guide in your own name.
drop policy if exists guides_insert on public.guides;
create policy guides_insert on public.guides for insert
  with check ((select auth.uid()) = author_id);

drop policy if exists guides_update on public.guides;
create policy guides_update on public.guides for update
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);

drop policy if exists guides_delete on public.guides;
create policy guides_delete on public.guides for delete
  using ((select auth.uid()) = author_id);

-- The subtlety worth stopping on: RLS is ROW level. The update policy above
-- lets an author update their own row — including votes. Without the grant
-- below, any author could set their own guide to nine thousand upvotes with
-- one API call, and every client-side check in the world would not see it.
-- Column grants are the mechanism that closes that.
revoke update on public.guides from anon, authenticated;
grant  update (title, blurb, champ, role, tag, body, author_name, updated_at)
  on public.guides to authenticated;

-- Votes: anyone may read the tally, you may only cast and withdraw your own.
drop policy if exists votes_read on public.guide_votes;
create policy votes_read on public.guide_votes for select using (true);

drop policy if exists votes_insert on public.guide_votes;
create policy votes_insert on public.guide_votes for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists votes_delete on public.guide_votes;
create policy votes_delete on public.guide_votes for delete
  using ((select auth.uid()) = user_id);

-- --------------------------------------------------------- a soft ceiling
--
-- Not real rate limiting — that belongs at the edge — but it stops one
-- account filling the table overnight, which is the failure mode on day
-- one of a public site with no moderation.

create or replace function public.guides_per_author_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.guides where author_id = new.author_id) >= 100 then
    raise exception 'That account already has 100 guides.';
  end if;
  return new;
end $$;

drop trigger if exists guides_limit on public.guides;
create trigger guides_limit before insert on public.guides
  for each row execute function public.guides_per_author_limit();

-- Supabase's linter flagged this and it was right: a SECURITY DEFINER
-- function in the public schema is published at /rest/v1/rpc/<name> and
-- callable by anyone holding the publishable key. Triggers fire as the
-- table owner and need no EXECUTE grant, so the grant is pure exposure.
revoke execute on function public.sync_vote_count()         from anon, authenticated, public;
revoke execute on function public.guides_per_author_limit() from anon, authenticated, public;


-- ============================================================
-- PROFILES
--
-- Added after the tables above, through migrations rather than by editing
-- this file, so for a while the live database had a table the schema did
-- not mention. This section is transcribed back from the running database;
-- it is what is actually there.
--
-- A display name is not on auth.users because auth.users is not readable
-- by other people. A byline has to be, or every guide on the site is by
-- an anonymous uuid.
-- ============================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null check (length(name) between 2 and 24),
  avatar_champ text,
  created_at   timestamptz not null default now()
);

-- Names are unique case-insensitively. author.html addresses a person by
-- name, so two people called "Seth" would make one of the two pages
-- unreachable.
create unique index if not exists profiles_name_key
  on public.profiles (lower(name));

alter table public.profiles enable row level security;

-- Anyone may read a profile: it is a public byline, and the site renders
-- author pages for signed-out visitors.
drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;

create policy profiles_read   on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert
  with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Column privileges, same pattern as guides: RLS chooses the ROW, grants
-- choose the COLUMNS. created_at is not writable by anyone.
revoke update on public.profiles from anon, authenticated;
grant  update (name, avatar_champ) on public.profiles to authenticated;

-- And id, which is not as strange as it looks.
--
-- The client saves a profile with one upsert (POST, Prefer:
-- resolution=merge-duplicates). PostgREST expands that to
--     on conflict (id) do update set id = excluded.id, name = ..., ...
-- listing every column in the payload, the conflict target included. Without
-- update(id) the whole statement is refused with 42501, which PostgREST
-- returns as 403 — and a 403 read as "not signed in", so the symptom was
-- an account page that claimed you were signed out while showing your email.
--
-- It grants nothing real: profiles_update requires auth.uid() = id in both
-- USING and WITH CHECK, so the only value that can be written to id is the
-- one already in the row. Verified — reassigning id to another uuid is
-- refused, and rows belonging to other people are not visible to update.
grant update (id) on public.profiles to authenticated;

-- A rename has to follow the guides already published, or every old guide
-- keeps the old byline until its row is next written.
create or replace function public.sync_author_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.guides set author_name = new.name where author_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists profiles_rename on public.profiles;
create trigger profiles_rename after update on public.profiles
  for each row execute function public.sync_author_name();

revoke execute on function public.sync_author_name() from anon, authenticated, public;
