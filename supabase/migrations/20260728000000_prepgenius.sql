-- Run in the Supabase SQL editor or through the Supabase CLI.
create extension if not exists vector with schema extensions;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  location text,
  headline text,
  summary text,
  skills text[] not null default '{}',
  education jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  total_experience_months integer not null default 0 check (total_experience_months >= 0),
  profile_text text not null default '',
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  extracted_text text,
  processing_status text not null default 'uploaded' check (processing_status in ('uploaded','processing','completed','failed')),
  processing_error text,
  created_at timestamptz not null default now()
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index candidates_user_idx on public.candidates(user_id);
create index resumes_user_idx on public.resumes(user_id);
create index jobs_user_idx on public.jobs(user_id);
create index candidates_embedding_idx on public.candidates using hnsw (embedding extensions.vector_cosine_ops);
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger candidates_updated_at before update on public.candidates for each row execute function public.set_updated_at();
create trigger jobs_updated_at before update on public.jobs for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.candidates enable row level security;
alter table public.resumes enable row level security;
alter table public.jobs enable row level security;
create policy "users own profile" on public.users for all using (id = auth.uid()) with check (id = auth.uid());
create policy "users own candidates" on public.candidates for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own resumes" on public.resumes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users own jobs" on public.jobs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false) on conflict (id) do nothing;
create policy "private resume upload" on storage.objects for insert to authenticated with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "private resume read" on storage.objects for select to authenticated using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "private resume delete" on storage.objects for delete to authenticated using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.match_candidates(query_embedding extensions.vector(1536), match_count int default 20)
returns table (id uuid, full_name text, headline text, skills text[], total_experience_months int, similarity float)
language sql stable security invoker set search_path = public, extensions as $$
  select c.id, c.full_name, c.headline, c.skills, c.total_experience_months,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.candidates c
  where c.user_id = auth.uid() and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 100);
$$;
