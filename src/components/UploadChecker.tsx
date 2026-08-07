"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import type { CheckReport, RuleStatus } from "@/lib/checkers/types";
import { getFirebaseAuth } from "@/lib/firebase/client";

const STATUS_META: Record<
  RuleStatus,
  { label: string; badgeClass: string; borderClass: string; icon: typeof CheckCircle2; iconClass: string }
> = {
  pass: {
    label: "Đạt",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20",
    borderClass: "border-l-emerald-500/60",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
  },
  fail: {
    label: "Không đạt",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20",
    borderClass: "border-l-red-500/60",
    icon: XCircle,
    iconClass: "text-red-500",
  },
  warning: {
    label: "Cần kiểm tra",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20",
    borderClass: "border-l-amber-500/60",
    icon: AlertTriangle,
    iconClass: "text-amber-500",
  },
};

interface CheckResponse {
  fileName: string;
  report: CheckReport;
}

function scoreRingColor(score: number) {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export default function UploadChecker() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
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
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const passCount = result?.report.results.filter((r) => r.status === "pass").length ?? 0;
  const total = result?.report.results.length ?? 0;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed p-10 md:p-12 text-center transition-all duration-200 ${
          dragActive
            ? "border-[var(--accent)] bg-[var(--accent-soft)] scale-[1.01]"
            : "border-black/15 dark:border-white/15 bg-[var(--card)]/50 hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={onInputChange}
        />
        <div
          className={`mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-200 ${
            dragActive ? "scale-110" : "group-hover:scale-105"
          } bg-[var(--accent-soft)] text-[var(--accent)]`}
        >
          <UploadCloud className="w-7 h-7" strokeWidth={2} />
        </div>
        <p className="font-medium">Kéo thả file .docx vào đây, hoặc bấm để chọn file</p>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1">
          Chỉ hỗ trợ Công văn (.docx), tối đa 10MB
        </p>
        {fileName && (
          <p className="inline-flex items-center gap-1.5 text-sm mt-4 font-mono bg-black/5 dark:bg-white/10 rounded-full px-3 py-1">
            <FileText className="w-3.5 h-3.5" />
            {fileName}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-black/60 dark:text-white/60 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang phân tích thể thức văn bản...
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl py-3 px-4 animate-fade-in-up">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4 animate-fade-in-up">
          <div className="flex items-center gap-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/8 dark:text-white/10" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke={scoreRingColor(result.report.score)}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(result.report.score / 100) * 100.5} 200`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {result.report.score}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{result.fileName}</p>
              <p className="text-sm text-black/50 dark:text-white/50">
                Loại văn bản: Công văn · {passCount}/{total} tiêu chí đạt
              </p>
            </div>
            <span
              className={`shrink-0 text-sm font-semibold px-3 py-1.5 rounded-full ${
                result.report.passed
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {result.report.passed ? "Đạt thể thức" : "Chưa đạt"}
            </span>
          </div>

          <ul className="flex flex-col gap-3">
            {result.report.results.map((r, i) => {
              const meta = STATUS_META[r.status];
              const Icon = meta.icon;
              return (
                <li
                  key={r.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={`animate-fade-in-up rounded-xl border border-[var(--border)] border-l-4 ${meta.borderClass} bg-[var(--card)] p-4 flex flex-col gap-1.5 shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium inline-flex items-center gap-2">
                      <Icon className={`w-4 h-4 shrink-0 ${meta.iconClass}`} strokeWidth={2} />
                      {r.label}
                    </span>
                    <span className={`shrink-0 text-xs font-medium rounded-full px-2.5 py-1 ${meta.badgeClass}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-sm text-black/70 dark:text-white/70 pl-6">{r.message}</p>
                  <p className="text-xs text-black/35 dark:text-white/35 pl-6">{r.reference}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
