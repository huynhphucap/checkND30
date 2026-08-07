import { ShieldCheck } from "lucide-react";
import UploadChecker from "@/components/UploadChecker";
import AuthButton from "@/components/AuthButton";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col px-6 py-10 md:py-16">
      <div className="max-w-2xl mx-auto w-full flex justify-end mb-8 md:mb-10">
        <AuthButton />
      </div>

      <header className="text-center flex flex-col items-center gap-4 mb-10 md:mb-14">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--border)] shadow-sm">
          <ShieldCheck className="w-7 h-7" strokeWidth={2} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
            Check thể thức văn bản
            <span className="block bg-gradient-to-r from-[var(--accent)] to-fuchsia-500 bg-clip-text text-transparent">
              theo Nghị định 30/2020/NĐ-CP
            </span>
          </h1>
          <p className="text-black/60 dark:text-white/60 max-w-xl mx-auto text-[15px] md:text-base leading-relaxed">
            Upload file Công văn (.docx) — hệ thống tự động kiểm tra font chữ,
            cỡ chữ, lề trang, quốc hiệu, tiêu ngữ, số ký hiệu và các tiêu chí
            thể thức khác theo đúng quy định.
          </p>
        </div>
      </header>

      <UploadChecker />

      <footer className="mt-16 md:mt-24 text-center text-xs text-black/35 dark:text-white/30">
        Đối chiếu theo Phụ lục I, Nghị định 30/2020/NĐ-CP về công tác văn thư.
      </footer>
    </main>
  );
}
