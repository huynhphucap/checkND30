"use client";

import { useRef, useState } from "react";
import type { CheckReport, RuleStatus } from "@/lib/checkers/types";
import { getFirebaseAuth } from "@/lib/firebase/client";

const STATUS_STYLE: Record<RuleStatus, { label: string; className: string }> = {
  pass: { label: "Đạt", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  fail: { label: "Không đạt", className: "bg-red-100 text-red-800 border-red-300" },
  warning: { label: "Cần kiểm tra", className: "bg-amber-100 text-amber-800 border-amber-300" },
};

interface CheckResponse {
  fileName: string;
  report: CheckReport;
}

export default function UploadChecker() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const currentUser = getFirebaseAuth().currentUser;
      const idToken = currentUser ? await currentUser.getIdToken() : null;

      const res = await fetch("/api/check", {
        method: "POST",
        body: formData,
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra khi kiểm tra file.");
        return;
      }
      setResult(data);
    } catch {
      setError("Không thể kết nối tới máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer border-2 border-dashed border-black/20 dark:border-white/20 rounded-xl p-10 text-center hover:border-black/40 dark:hover:border-white/40 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={onInputChange}
        />
        <p className="font-medium">Kéo thả file .docx vào đây, hoặc bấm để chọn file</p>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">
          Chỉ hỗ trợ Công văn (.docx), tối đa 10MB
        </p>
        {fileName && <p className="text-sm mt-3 font-mono">{fileName}</p>}
      </div>

      {loading && <p className="text-center text-sm">Đang kiểm tra...</p>}

      {error && (
        <p className="text-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg py-2 px-3">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 p-4">
            <div>
              <p className="font-semibold">{result.fileName}</p>
              <p className="text-sm text-black/60 dark:text-white/60">
                Loại văn bản: Công văn
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{result.report.score}/100</p>
              <p
                className={
                  result.report.passed
                    ? "text-emerald-700 text-sm font-medium"
                    : "text-red-700 text-sm font-medium"
                }
              >
                {result.report.passed ? "Đạt thể thức" : "Chưa đạt thể thức"}
              </p>
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {result.report.results.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-black/10 dark:border-white/10 p-4 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.label}</span>
                  <span
                    className={`shrink-0 text-xs font-medium border rounded-full px-2 py-0.5 ${STATUS_STYLE[r.status].className}`}
                  >
                    {STATUS_STYLE[r.status].label}
                  </span>
                </div>
                <p className="text-sm text-black/70 dark:text-white/70">{r.message}</p>
                <p className="text-xs text-black/40 dark:text-white/40">{r.reference}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
