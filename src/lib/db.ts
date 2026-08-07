import postgres from "postgres";

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

function createSqlClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Thiếu biến môi trường DATABASE_URL (connection string Neon).");
  }
  return postgres(connectionString, { ssl: "require" });
}

// Next.js dev mode reload lại module mỗi request; giữ 1 connection pool duy nhất qua globalThis.
// Khởi tạo lazy để tránh lỗi khi Next.js phân tích route lúc build (chưa có env).
export function getSql() {
  if (!globalThis.__sql) {
    globalThis.__sql = createSqlClient();
  }
  return globalThis.__sql;
}
