-- Bảng lưu lịch sử kiểm tra văn bản theo Nghị định 30/2020/NĐ-CP
create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  file_name text not null,
  doc_type text not null default 'cong_van',
  score integer not null,
  passed boolean not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists checks_user_id_idx on public.checks (user_id);
create index if not exists checks_created_at_idx on public.checks (created_at desc);

alter table public.checks enable row level security;

-- Chủ sở hữu xem được lịch sử của chính mình
create policy "checks_select_own"
  on public.checks for select
  using (auth.uid() = user_id);

-- Cho phép user đã đăng nhập tự tạo bản ghi của chính mình
create policy "checks_insert_own"
  on public.checks for insert
  with check (auth.uid() = user_id);

-- Storage bucket chứa file .docx người dùng upload
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

create policy "uploads_owner_rw"
  on storage.objects for all
  using (bucket_id = 'uploads' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'uploads' and auth.uid()::text = (storage.foldername(name))[1]);
