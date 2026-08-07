# Check Nghị định 30

App kiểm tra thể thức, kỹ thuật trình bày văn bản hành chính (Công văn) theo
Nghị định 30/2020/NĐ-CP về công tác văn thư. Người dùng upload file `.docx`,
hệ thống đọc font chữ, cỡ chữ, lề trang, cấu trúc (quốc hiệu, tiêu ngữ, số ký
hiệu, ngày tháng, nơi nhận...) và trả về báo cáo Đạt/Không đạt/Cần kiểm tra
cho từng tiêu chí.

Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Auth,
Postgres, Storage).

## 1. Tạo Supabase project

1. Vào [supabase.com](https://supabase.com) → tạo project mới.
2. Vào **Project Settings → API**, lấy 3 giá trị:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (bí mật, chỉ dùng ở server)
3. Copy `.env.local.example` thành `.env.local` và điền các giá trị trên:

   ```bash
   cp .env.local.example .env.local
   ```

## 2. Chạy migration (tạo bảng + policy)

File SQL migration nằm ở `supabase/migrations/0001_init.sql` — tạo bảng
`checks` (lưu lịch sử kiểm tra), bật Row Level Security, và tạo bucket
Storage `uploads`.

Cách 1 - dán trực tiếp vào **SQL Editor** trên Supabase Dashboard.

Cách 2 - dùng Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

## 3. Chạy app local

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

Đăng nhập không bắt buộc để dùng tính năng check — chỉ cần để lưu lịch sử
kiểm tra. Việc bật đăng nhập (Google/email OTP...) cấu hình tại **Supabase
Dashboard → Authentication → Providers**.

## 4. Cấu trúc chính

```
src/
  app/
    api/check/route.ts     # nhận file .docx, phân tích, trả kết quả
    page.tsx                # trang chủ (upload + hiển thị báo cáo)
  components/
    UploadChecker.tsx        # UI upload + render kết quả
  lib/
    docx/parseDocx.ts        # đọc font/cỡ chữ/lề/nội dung từ .docx
    checkers/congvan.ts       # rule engine theo Phụ lục I, NĐ 30/2020/NĐ-CP
    supabase/                # client, server, admin, middleware helpers
supabase/migrations/          # SQL schema + RLS policies
```

## 5. Mở rộng thêm loại văn bản

Hiện MVP mới hỗ trợ **Công văn**. Để thêm Quyết định, Thông báo, Tờ trình...
tạo thêm file rule engine trong `src/lib/checkers/`, theo cùng interface
`CheckReport`/`RuleResult` ở `src/lib/checkers/types.ts`.

## Deploy

Deploy được lên [Vercel](https://vercel.com/new) — nhớ khai báo đủ 3 biến
môi trường Supabase ở phần **Environment Variables** của project.
