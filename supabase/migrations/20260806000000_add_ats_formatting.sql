-- Add ATS formatting report column to resumes table
alter table public.resumes
add column if not exists ats_formatting_report jsonb default null;

-- Add index for quick lookups
create index if not exists resumes_ats_status_idx on public.resumes(processing_status, user_id);
