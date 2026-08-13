import { ShieldCheck } from "lucide-react";
import AuthButton from "@/components/AuthButton";

export default function TopBar() {
  return (
    <div className="sticky top-0 z-40">
      <div className="h-1 bg-gradient-to-r from-[var(--accent)] via-fuchsia-500 to-[var(--accent)] bg-[length:200%_100%] animate-gradient-x" />
      <header className="bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)] shadow-sm">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--border)] shrink-0">
              <ShieldCheck className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="font-semibold truncate">Check Nghị định 30</p>
              <p className="text-xs text-black/45 dark:text-white/40 truncate">
                Kiểm tra thể thức văn bản hành chính
              </p>
            </div>
          </div>
          <AuthButton />
        </div>
      </header>
    </div>
  );
}
