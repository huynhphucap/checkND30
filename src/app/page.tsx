import UploadChecker from "@/components/UploadChecker";
import AuthButton from "@/components/AuthButton";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col gap-10 px-6 py-16">
      <div className="max-w-2xl mx-auto w-full flex justify-end">
        <AuthButton />
      </div>

      <header className="text-center flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold">
          Check thể thức văn bản theo Nghị định 30
        </h1>
        <p className="text-black/60 dark:text-white/60 max-w-xl mx-auto">
          Upload file Công văn (.docx) để kiểm tra thể thức, kỹ thuật trình bày
          theo Nghị định 30/2020/NĐ-CP.
        </p>
      </header>

      <UploadChecker />
    </main>
  );
}
