-- Stores the searchable screen fields alongside the complete plugin record.
create table if not exists public.nexus_screens (
  id text primary key,
  app text not null check (app in ('Consumer App', 'Merchant App', 'Driver App')),
  team text not null,
  feature_name text not null,
  screen_name text not null,
  status text not null default 'pending_storage',
  preview_url text,
  source_node_url text,
  record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nexus_screens_grouping_idx
  on public.nexus_screens (app, team, feature_name);

create index if not exists nexus_screens_updated_at_idx
  on public.nexus_screens (updated_at desc);

alter table public.nexus_screens enable row level security;

-- The current Figma plugin has no Supabase user session yet, so its publishable
-- key uses the anon role. Replace these policies with authenticated team access
-- before distributing the plugin outside the internal design organization.
do $$ begin
  create policy "Nexus screens are readable"
    on public.nexus_screens for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Nexus screens can be inserted"
    on public.nexus_screens for insert
    to anon, authenticated
    with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Nexus screens can be updated"
    on public.nexus_screens for update
    to anon, authenticated
    using (true)
    with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Nexus screens can be deleted"
    on public.nexus_screens for delete
    to anon, authenticated
    using (true);
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on table public.nexus_screens to anon, authenticated;

-- Public preview files are safe to render directly in both the website and plugin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nexus-screen-previews',
  'nexus-screen-previews',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  create policy "Nexus previews are readable"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'nexus-screen-previews');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Nexus previews can be inserted"
    on storage.objects for insert
    to anon, authenticated
    with check (bucket_id = 'nexus-screen-previews');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Nexus previews can be updated"
    on storage.objects for update
    to anon, authenticated
    using (bucket_id = 'nexus-screen-previews')
    with check (bucket_id = 'nexus-screen-previews');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Nexus previews can be deleted"
    on storage.objects for delete
    to anon, authenticated
    using (bucket_id = 'nexus-screen-previews');
exception when duplicate_object then null; end $$;
