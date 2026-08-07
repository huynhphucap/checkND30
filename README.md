# Check Nghị định 30

App kiểm tra thể thức, kỹ thuật trình bày văn bản hành chính (Công văn) theo
Nghị định 30/2020/NĐ-CP về công tác văn thư. Người dùng upload file `.docx`,
hệ thống đọc font chữ, cỡ chữ, lề trang, cấu trúc (quốc hiệu, tiêu ngữ, số ký
hiệu, ngày tháng, nơi nhận...) và trả về báo cáo Đạt/Không đạt/Cần kiểm tra
cho từng tiêu chí.

Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Neon (Postgres
serverless) + Auth.js (Google sign-in).

## 1. Tạo Neon project (database)

1. Vào [neon.tech](https://neon.tech) → tạo project mới (free tier).
2. Vào **Connection Details**, copy connection string dạng
   `postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require`.
3. Copy `.env.local.example` thành `.env.local` và điền vào `DATABASE_URL`:

   ```bash
   cp .env.local.example .env.local
   ```

## 2. Chạy migration (tạo bảng)

File SQL nằm ở `db/migrations/0001_init.sql` — tạo bảng `checks` lưu lịch sử
kiểm tra. Dán trực tiếp vào **SQL Editor** trên Neon Console, hoặc chạy qua
`psql`:

```bash
psql "$DATABASE_URL" -f db/migrations/0001_init.sql
```

## 3. Tạo Google OAuth (đăng nhập, không bắt buộc)

Đăng nhập là tuỳ chọn — dùng để lưu lịch sử kiểm tra. App vẫn check được
file bình thường khi chưa đăng nhập.

1. Vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   → **Create Credentials → OAuth client ID** → loại **Web application**.
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   (production thì thêm domain thật, ví dụ
   `https://your-domain.com/api/auth/callback/google`).
3. Điền `AUTH_GOOGLE_ID` và `AUTH_GOOGLE_SECRET` vào `.env.local`.
4. Sinh `AUTH_SECRET`:

   ```bash
   npx auth secret
   ```

## 4. Chạy app local

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## 5. Cấu trúc chính

```
src/
  app/
    api/check/route.ts       # nhận file .docx, phân tích, trả kết quả
    api/auth/[...nextauth]/  # route handler Auth.js
    page.tsx                 # trang chủ (upload + hiển thị báo cáo)
  components/
    UploadChecker.tsx        # UI upload + render kết quả
    AuthButton.tsx            # nút đăng nhập/đăng xuất Google
  lib/
    docx/parseDocx.ts        # đọc font/cỡ chữ/lề/nội dung từ .docx
    checkers/congvan.ts       # rule engine theo Phụ lục I, NĐ 30/2020/NĐ-CP
    db.ts                     # kết nối Neon (postgres.js)
    auth.ts                   # cấu hình Auth.js (Google, JWT session)
db/migrations/                # SQL schema
```

## 6. Mở rộng thêm loại văn bản

Hiện MVP mới hỗ trợ **Công văn**. Để thêm Quyết định, Thông báo, Tờ trình...
tạo thêm file rule engine trong `src/lib/checkers/`, theo cùng interface
`CheckReport`/`RuleResult` ở `src/lib/checkers/types.ts`.

## Deploy

Deploy được lên [Vercel](https://vercel.com/new) — khai báo đủ 4 biến môi
trường (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
`AUTH_GOOGLE_SECRET`) ở phần **Environment Variables**, và cập nhật
Authorized redirect URI trên Google Cloud Console sang domain production.
