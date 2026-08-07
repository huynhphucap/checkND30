# Check Nghị định 30

App kiểm tra thể thức, kỹ thuật trình bày văn bản hành chính (Công văn) theo
Nghị định 30/2020/NĐ-CP về công tác văn thư. Người dùng upload file `.docx`,
hệ thống đọc font chữ, cỡ chữ, lề trang, cấu trúc (quốc hiệu, tiêu ngữ, số ký
hiệu, ngày tháng, nơi nhận...) và trả về báo cáo Đạt/Không đạt/Cần kiểm tra
cho từng tiêu chí.

Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Firebase
(Authentication + Firestore).

## 1. Tạo Firebase project

1. Vào [Firebase Console](https://console.firebase.google.com) → tạo project mới.
2. Vào **Project settings → General → Your apps** → thêm 1 Web app, copy
   config (`apiKey`, `authDomain`, `projectId`...).
3. Vào **Build → Authentication → Sign-in method** → bật **Google**.
4. Vào **Build → Firestore Database** → tạo database (chọn chế độ
   Production, region gần Việt Nam, ví dụ `asia-southeast1`).
5. Vào **Project settings → Service accounts** → **Generate new private key**
   → tải file JSON (dùng cho `firebase-admin` ở server, để lưu lịch sử kiểm tra).

## 2. Điền biến môi trường

```bash
cp .env.local.example .env.local
```

Điền 6 biến `NEXT_PUBLIC_FIREBASE_*` từ bước 1.2, và 3 biến
`FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` lấy
từ file JSON service account ở bước 1.5 (giữ nguyên `\n` trong private key,
để trong dấu ngoặc kép).

## 3. Deploy Firestore rules (tuỳ chọn nhưng nên làm)

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # chọn project vừa tạo, đặt alias "default"
firebase deploy --only firestore:rules
```

`firestore.rules` chỉ cho phép user đọc đúng lịch sử của chính mình; việc
ghi dữ liệu chỉ thực hiện qua server (`firebase-admin`, bỏ qua rules).

## 4. Chạy app local

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

Đăng nhập Google là tuỳ chọn — dùng để lưu lịch sử kiểm tra vào Firestore.
App vẫn check được file bình thường khi chưa đăng nhập.

## 5. Cấu trúc chính

```
src/
  app/
    api/check/route.ts       # nhận file .docx, phân tích, verify idToken, lưu Firestore
    page.tsx                 # trang chủ (upload + hiển thị báo cáo)
  components/
    UploadChecker.tsx        # UI upload + render kết quả, gửi kèm idToken nếu đã đăng nhập
    AuthButton.tsx            # đăng nhập/đăng xuất Google (Firebase Auth client SDK)
  lib/
    docx/parseDocx.ts        # đọc font/cỡ chữ/lề/nội dung từ .docx
    checkers/congvan.ts       # rule engine theo Phụ lục I, NĐ 30/2020/NĐ-CP
    firebase/client.ts        # Firebase SDK phía trình duyệt (Auth)
    firebase/admin.ts         # Firebase Admin SDK phía server (verify token, Firestore)
firestore.rules                # Security rules cho collection "checks"
```

## 6. Mở rộng thêm loại văn bản

Hiện MVP mới hỗ trợ **Công văn**. Để thêm Quyết định, Thông báo, Tờ trình...
tạo thêm file rule engine trong `src/lib/checkers/`, theo cùng interface
`CheckReport`/`RuleResult` ở `src/lib/checkers/types.ts`.

## Deploy

Deploy được lên [Vercel](https://vercel.com/new) — khai báo đủ 9 biến môi
trường Firebase ở phần **Environment Variables**. Nếu deploy lên Firebase
Hosting (frameworks/Next.js) thì chạy `firebase deploy`.
