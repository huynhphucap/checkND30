create extension if not exists pgcrypto;

-- Bảng lưu lịch sử kiểm tra văn bản theo Nghị định 30/2020/NĐ-CP
-- user_id lưu "sub" (Google account id) từ Auth.js, không dùng FK vì không có bảng users riêng.
create table if not exists checks (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  user_email text,
  file_name text not null,
  doc_type text not null default 'cong_van',
  score integer not null,
  passed boolean not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists checks_user_id_idx on checks (user_id);
create index if not exists checks_created_at_idx on checks (created_at desc);
