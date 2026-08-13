"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  UploadCloud,
  XCircle,
} from "lucide-react";
import type { CheckReport, RuleStatus } from "@/lib/checkers/types";
import { getFirebaseAuth } from "@/lib/firebase/client";

const CHECK_TOAST_ID = "docx-check";

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

// Thứ tự ưu tiên hiển thị: lỗi nặng trước, để không phải cuộn nhiều mới thấy vấn đề.
const STATUS_ORDER: RuleStatus[] = ["fail", "warning", "pass"];

type FilterValue = "all" | RuleStatus;

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
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast.error("Chỉ hỗ trợ file .docx", {
        description: `"${file.name}" không đúng định dạng yêu cầu.`,
      });
      return;
    }

    setLoading(true);
    setResult(null);
    setFilter("all");
    setFileName(file.name);
    toast.loading("Đang phân tích thể thức văn bản...", { id: CHECK_TOAST_ID });

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
        toast.error(data.error ?? "Có lỗi xảy ra khi kiểm tra file.", { id: CHECK_TOAST_ID });
        return;
      }
      const checkResult = data as CheckResponse;
      setResult(checkResult);

      const okCount = checkResult.report.results.filter((r) => r.status === "pass").length;
      const total = checkResult.report.results.length;
      if (checkResult.report.passed) {
        toast.success("Đạt thể thức văn bản!", {
          id: CHECK_TOAST_ID,
          description: `${okCount}/${total} tiêu chí đạt yêu cầu.`,
        });
      } else {
        toast.warning("Văn bản chưa đạt thể thức", {
          id: CHECK_TOAST_ID,
          description: `${okCount}/${total} tiêu chí đạt - xem chi tiết bên dưới để chỉnh sửa.`,
        });
      }
    } catch {
      toast.error("Không thể kết nối tới máy chủ. Vui lòng thử lại.", { id: CHECK_TOAST_ID });
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

  const results = useMemo(() => result?.report.results ?? [], [result]);
  const total = results.length;
  const counts = useMemo(() => {
    const c: Record<RuleStatus, number> = { pass: 0, fail: 0, warning: 0 };
    for (const r of results) c[r.status]++;
    return c;
  }, [results]);
  const passCount = counts.pass;

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)),
    [results]
  );
  const visibleResults = filter === "all" ? sortedResults : sortedResults.filter((r) => r.status === filter);

  const filterOptions: Array<{ value: FilterValue; label: string; count: number }> = [
    { value: "all", label: "Tất cả", count: total },
    { value: "fail", label: STATUS_META.fail.label, count: counts.fail },
    { value: "warning", label: STATUS_META.warning.label, count: counts.warning },
    { value: "pass", label: STATUS_META.pass.label, count: counts.pass },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!loading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          if (!loading) onDrop(e);
          else e.preventDefault();
        }}
        onClick={() => !loading && inputRef.current?.click()}
        className={`group rounded-2xl border-2 border-dashed p-10 md:p-12 text-center transition-all duration-200 ${
          loading
            ? "cursor-wait border-black/10 dark:border-white/10 bg-[var(--card)]/50"
            : "cursor-pointer"
        } ${
          dragActive
            ? "border-[var(--accent)] bg-[var(--accent-soft)] scale-[1.01]"
            : loading
              ? ""
              : "border-black/15 dark:border-white/15 bg-[var(--card)]/50 hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={onInputChange}
          disabled={loading}
        />
        <div
          className={`mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-200 ${
            dragActive ? "scale-110" : "group-hover:scale-105"
          } bg-[var(--accent-soft)] text-[var(--accent)]`}
        >
          {loading ? (
            <Loader2 className="w-7 h-7 animate-spin" strokeWidth={2} />
          ) : (
            <UploadCloud className="w-7 h-7" strokeWidth={2} />
          )}
        </div>
        <p className="font-medium">
          {loading ? "Đang phân tích thể thức văn bản..." : "Kéo thả file .docx vào đây"}
        </p>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1 mb-5">
          {loading ? "Vui lòng chờ trong giây lát" : "Chỉ hỗ trợ Công văn (.docx), tối đa 10MB"}
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-fuchsia-500 text-white text-sm font-semibold px-5 py-2.5 shadow-md shadow-[var(--accent)]/20 transition-all hover:shadow-lg hover:shadow-[var(--accent)]/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0"
        >
          <UploadCloud className="w-4 h-4" strokeWidth={2.25} />
          Chọn file để kiểm tra
        </button>
        {fileName && (
          <p className="inline-flex items-center gap-1.5 text-sm mt-5 font-mono bg-black/5 dark:bg-white/10 rounded-full px-3 py-1">
            <FileText className="w-3.5 h-3.5" />
            {fileName}
          </p>
        )}
      </div>

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
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span
                className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
                  result.report.passed
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                {result.report.passed ? "Đạt thể thức" : "Chưa đạt"}
              </span>
              {!result.report.passed && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/25 rounded-full px-3 py-1.5 transition-all hover:ring-[var(--accent)]/50 hover:-translate-y-0.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                  Sửa xong, kiểm tra lại
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {filterOptions.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  disabled={opt.count === 0 && opt.value !== "all"}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-full px-3.5 py-1.5 border transition-all disabled:opacity-35 disabled:cursor-not-allowed ${
                    active
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-md shadow-[var(--accent)]/25"
                      : "bg-[var(--card)] text-black/70 dark:text-white/70 border-[var(--border)] hover:border-[var(--accent)]/50 hover:-translate-y-0.5"
                  }`}
                >
                  {opt.label}
                  <span
                    className={`text-xs rounded-full px-1.5 ${
                      active ? "bg-white/20" : "bg-black/5 dark:bg-white/10"
                    }`}
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>

          {visibleResults.length === 0 ? (
            <p className="text-center text-sm text-black/50 dark:text-white/50 py-8">
              Không có tiêu chí nào ở mục này.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 max-h-[32rem] overflow-y-auto pr-1 -mr-1">
              {visibleResults.map((r, i) => {
                const meta = STATUS_META[r.status];
                const Icon = meta.icon;
                return (
                  <li
                    key={r.id}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
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
          )}
        </div>
      )}
    </div>
  );
}
