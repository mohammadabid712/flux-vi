-- Allow client-generated non-UUID fallback ids for projects
alter table public.media_assets drop constraint if exists media_assets_project_id_fkey;
alter table public.exports drop constraint if exists exports_project_id_fkey;
alter table public.projects alter column id type text using id::text;
alter table public.media_assets alter column project_id type text using project_id::text;
alter table public.exports alter column project_id type text using project_id::text;
alter table public.media_assets add constraint media_assets_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;
alter table public.exports add constraint exports_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;
