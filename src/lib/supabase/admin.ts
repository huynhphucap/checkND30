import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Dùng service role key: chỉ import trong code chạy trên server (API routes),
// bỏ qua Row Level Security nên KHÔNG được export ra client.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
