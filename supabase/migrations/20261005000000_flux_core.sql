-- Flux VI core schema: profiles, projects, media assets, exports + RLS + storage policies

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  storage_used_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled Project',
  aspect_ratio text not null default '16:9',
  resolution text not null default '1080p',
  fps int not null default 60,
  duration double precision not null default 60,
  tracks_data jsonb not null default '[]'::jsonb,
  cover_art text,
  thumbnail_url text,
  is_cloud_synced boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);
create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  file_name text not null,
  file_url text not null,
  storage_path text not null,
  file_size bigint not null default 0 check (file_size >= 0),
  mime_type text,
  media_type text not null check (media_type in ('video','audio','image')),
  duration double precision not null default 5,
  created_at timestamptz not null default now()
);
create index if not exists media_assets_user_idx on public.media_assets (user_id, created_at desc);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  preset text not null,
  width int not null,
  height int not null,
  fps int not null,
  file_name text not null,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Server-maintained timestamps
create or replace function public.touch_server_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_updated_at := now();
  return new;
end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before insert or update on public.projects
for each row execute function public.touch_server_updated_at();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep profile storage usage in sync with media assets
create or replace function public.sync_storage_used() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  uid := coalesce(new.user_id, old.user_id);
  update public.profiles
     set storage_used_bytes = (select coalesce(sum(file_size), 0) from public.media_assets where user_id = uid)
   where id = uid;
  return null;
end $$;
drop trigger if exists media_assets_storage on public.media_assets;
create trigger media_assets_storage after insert or delete on public.media_assets
for each row execute function public.sync_storage_used();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_storage_used() from public, anon, authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.media_assets enable row level security;
alter table public.exports enable row level security;

revoke all on public.profiles, public.projects, public.media_assets, public.exports from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete on public.media_assets to authenticated;
grant select, insert on public.exports to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "projects_select_own" on public.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "projects_insert_own" on public.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "projects_update_own" on public.projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projects_delete_own" on public.projects for delete to authenticated using ((select auth.uid()) = user_id);

create policy "media_select_own" on public.media_assets for select to authenticated using ((select auth.uid()) = user_id);
create policy "media_insert_own" on public.media_assets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "media_delete_own" on public.media_assets for delete to authenticated using ((select auth.uid()) = user_id);

create policy "exports_select_own" on public.exports for select to authenticated using ((select auth.uid()) = user_id);
create policy "exports_insert_own" on public.exports for insert to authenticated with check ((select auth.uid()) = user_id);

-- Storage: project-media bucket, objects under "<user_id>/..."
create policy "project_media_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'project-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "project_media_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "project_media_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'project-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'project-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "project_media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'project-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
