import type { ParsedDocx, DocxParagraph } from "@/lib/docx/parseDocx";
import type { CheckReport, RuleResult, RuleStatus } from "./types";

const REF_PHU_LUC_I = "Nghị định 30/2020/NĐ-CP, Phụ lục I";

const MM_TOLERANCE = 1.5;

function inRange(value: number | undefined, min: number, max: number, tolerance = 0): boolean {
  if (value === undefined) return false;
  return value >= min - tolerance && value <= max + tolerance;
}

function normalize(text: string): string {
  // Chuẩn hoá về NFC: Word đôi khi lưu chữ Việt ở dạng tổ hợp (NFD, ví dụ "a" + dấu huyền
  // riêng) - nhìn giống hệt "à" (NFC) nhưng khác chuỗi ký tự, khiến regex không khớp.
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

function stripDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d");
}

function paragraphFontFamilies(p: DocxParagraph): string[] {
  return Array.from(
    new Set(p.runs.filter((r) => normalize(r.text).length > 0).map((r) => r.fontFamily).filter(Boolean))
  ) as string[];
}

function paragraphIsBold(p: DocxParagraph): boolean {
  const runs = p.runs.filter((r) => normalize(r.text).length > 0);
  if (runs.length === 0) return false;
  return runs.every((r) => r.bold);
}

function paragraphIsItalic(p: DocxParagraph): boolean {
  const runs = p.runs.filter((r) => normalize(r.text).length > 0);
  if (runs.length === 0) return false;
  return runs.every((r) => r.italic);
}

function findParagraphIndex(
  paragraphs: DocxParagraph[],
  predicate: (text: string, p: DocxParagraph) => boolean
): number {
  return paragraphs.findIndex((p) => predicate(normalize(p.text), p));
}

export function checkCongVan(doc: ParsedDocx): CheckReport {
  const results: RuleResult[] = [];
  const { paragraphs, margins, pageWidthMm, pageHeightMm } = doc;

  // 1. Khổ giấy A4
  const isA4 = inRange(pageWidthMm, 210, 210, 3) && inRange(pageHeightMm, 297, 297, 3);
  results.push({
    id: "page_size",
    label: "Khổ giấy A4 (210mm x 297mm)",
    status: pageWidthMm && pageHeightMm ? (isA4 ? "pass" : "fail") : "warning",
    message:
      pageWidthMm && pageHeightMm
        ? isA4
          ? `Đạt: khổ giấy ${pageWidthMm.toFixed(0)}mm x ${pageHeightMm.toFixed(0)}mm.`
          : `Không đạt: khổ giấy hiện tại ${pageWidthMm.toFixed(0)}mm x ${pageHeightMm.toFixed(0)}mm, yêu cầu A4 (210mm x 297mm).`
        : "Không xác định được khổ giấy trong file.",
    reference: REF_PHU_LUC_I,
  });

  // 2. Lề trang: trên/dưới 20-25mm, trái 30-35mm, phải 15-20mm
  const marginChecks: Array<{ key: keyof typeof margins; label: string; min: number; max: number }> = [
    { key: "topMm", label: "lề trên", min: 20, max: 25 },
    { key: "bottomMm", label: "lề dưới", min: 20, max: 25 },
    { key: "leftMm", label: "lề trái", min: 30, max: 35 },
    { key: "rightMm", label: "lề phải", min: 15, max: 20 },
  ];
  const marginProblems = marginChecks.filter(
    (m) => !inRange(margins[m.key], m.min, m.max, MM_TOLERANCE)
  );
  results.push({
    id: "margins",
    label: "Định lề trang (trên/dưới 20-25mm, trái 30-35mm, phải 15-20mm)",
    status: marginProblems.length === 0 ? "pass" : "fail",
    message:
      marginProblems.length === 0
        ? "Đạt: các lề trang nằm trong khoảng quy định."
        : `Không đạt: ${marginProblems
            .map((m) => {
              const val = margins[m.key];
              return `${m.label} = ${val !== undefined ? val.toFixed(1) + "mm" : "không xác định"} (yêu cầu ${m.min}-${m.max}mm)`;
            })
            .join("; ")}.`,
    reference: REF_PHU_LUC_I,
  });

  // 3. Font chữ Times New Roman toàn văn bản
  const nonTimesParagraphs = paragraphs.filter((p) => {
    const fonts = paragraphFontFamilies(p);
    return fonts.length > 0 && fonts.some((f) => !f.toLowerCase().includes("times new roman"));
  });
  const fontExample = nonTimesParagraphs[0];
  const fontExampleWrongFont = fontExample
    ? paragraphFontFamilies(fontExample).find((f) => !f.toLowerCase().includes("times new roman"))
    : undefined;
  results.push({
    id: "font_family",
    label: "Phông chữ Times New Roman",
    status: nonTimesParagraphs.length === 0 ? "pass" : "fail",
    message:
      nonTimesParagraphs.length === 0
        ? "Đạt: toàn bộ văn bản dùng phông Times New Roman."
        : `Không đạt: có ${nonTimesParagraphs.length} đoạn đang dùng phông "${fontExampleWrongFont ?? "khác"}" thay vì Times New Roman - VD đoạn "${normalize(
            fontExample.text
          ).slice(0, 50)}".`,
    reference: REF_PHU_LUC_I,
  });

  // 4. Cỡ chữ nội dung 13-14pt
  const bodyParagraphs = paragraphs.filter((p) => normalize(p.text).length > 15);
  const wrongSizeParagraphs = bodyParagraphs.filter((p) => {
    const sizes = p.runs.filter((r) => normalize(r.text).length > 0).map((r) => r.fontSizePt);
    return sizes.length > 0 && sizes.some((s) => s !== undefined && !inRange(s, 13, 14, 0.5));
  });
  results.push({
    id: "font_size",
    label: "Cỡ chữ nội dung 13-14pt",
    status:
      bodyParagraphs.length === 0
        ? "warning"
        : wrongSizeParagraphs.length === 0
          ? "pass"
          : "warning",
    message:
      bodyParagraphs.length === 0
        ? "Không xác định được đoạn nội dung để kiểm tra cỡ chữ."
        : wrongSizeParagraphs.length === 0
          ? "Đạt: cỡ chữ nội dung trong khoảng 13-14pt."
          : `Cần kiểm tra lại: có ${wrongSizeParagraphs.length} đoạn cỡ chữ ngoài khoảng 13-14pt.`,
    reference: REF_PHU_LUC_I,
  });

  // 5. Quốc hiệu
  // Khối quốc hiệu/tiêu ngữ thường nằm trong bảng 2 cột đầu văn bản (cùng tên cơ quan ban
  // hành), đôi khi bảng đó còn bọc trong content control (Quick Parts). paragraphs đã giữ
  // đúng thứ tự thật và duyệt cả 2 trường hợp trên, nên tìm trên toàn bộ danh sách thay vì
  // giới hạn 10 đoạn đầu - tránh bỏ sót khi bảng letterhead có nhiều dòng/ô hơn dự kiến.
  const quocHieuIdx = findParagraphIndex(paragraphs, (t) =>
    stripDiacritics(t).toUpperCase().includes("CONG HOA XA HOI CHU NGHIA VIET NAM")
  );
  const quocHieu = quocHieuIdx >= 0 ? paragraphs[quocHieuIdx] : undefined;
  const quocHieuIssues: string[] = [];
  if (quocHieu) {
    if (quocHieu.alignment !== "center") quocHieuIssues.push("chưa canh giữa");
    if (!paragraphIsBold(quocHieu)) quocHieuIssues.push("chưa in đậm");
    if (normalize(quocHieu.text) !== normalize(quocHieu.text).toUpperCase()) quocHieuIssues.push("chưa in hoa toàn bộ");
  }
  const quocHieuOk = !!quocHieu && quocHieuIssues.length === 0;
  results.push({
    id: "quoc_hieu",
    label: 'Quốc hiệu "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"',
    status: !quocHieu ? "fail" : quocHieuOk ? "pass" : "warning",
    message: !quocHieu
      ? "Không tìm thấy dòng Quốc hiệu trong phần đầu văn bản."
      : quocHieuOk
        ? "Đạt: Quốc hiệu in hoa, đậm, căn giữa."
        : `Tìm thấy dòng Quốc hiệu nhưng ${quocHieuIssues.join(", ")}.`,
    reference: REF_PHU_LUC_I,
  });

  // 6. Tiêu ngữ
  const tieuNguIdx = findParagraphIndex(paragraphs, (t) => {
    const s = stripDiacritics(t).toLowerCase();
    return s.includes("doc lap") && s.includes("tu do") && s.includes("hanh phuc");
  });
  const tieuNgu = tieuNguIdx >= 0 ? paragraphs[tieuNguIdx] : undefined;
  const tieuNguIssues: string[] = [];
  if (tieuNgu) {
    if (tieuNgu.alignment !== "center") tieuNguIssues.push("chưa canh giữa");
    if (!paragraphIsBold(tieuNgu)) tieuNguIssues.push("chưa in đậm");
  }
  const tieuNguOk = !!tieuNgu && tieuNguIssues.length === 0;
  results.push({
    id: "tieu_ngu",
    label: 'Tiêu ngữ "Độc lập - Tự do - Hạnh phúc"',
    status: !tieuNgu ? "fail" : tieuNguOk ? "pass" : "warning",
    message: !tieuNgu
      ? "Không tìm thấy dòng Tiêu ngữ ngay dưới Quốc hiệu."
      : tieuNguOk
        ? "Đạt: Tiêu ngữ đậm, căn giữa, có gạch nối giữa các cụm từ."
        : `Tìm thấy Tiêu ngữ nhưng ${tieuNguIssues.join(", ")}.`,
    reference: REF_PHU_LUC_I,
  });

  // 7. Số, ký hiệu văn bản
  const soKyHieuIdx = findParagraphIndex(paragraphs, (t) => /s[ốo]\s*:/i.test(t) || /^s[ốo]\s*\d/i.test(t));
  results.push({
    id: "so_ky_hieu",
    label: "Số, ký hiệu văn bản",
    status: soKyHieuIdx >= 0 ? "pass" : "fail",
    message:
      soKyHieuIdx >= 0
        ? `Đạt: tìm thấy dòng số ký hiệu ("${normalize(paragraphs[soKyHieuIdx].text).slice(0, 60)}").`
        : 'Không đạt: không tìm thấy dòng "Số: .../..." trong văn bản.',
    reference: REF_PHU_LUC_I,
  });

  // 8. Địa danh, ngày tháng năm ban hành
  // Regex "lỏng": chỉ cần có đủ 3 từ khoá ngày/tháng/năm theo đúng thứ tự, số ở mỗi phần là
  // tuỳ chọn - để phân biệt được 3 trường hợp khác nhau: "không có dòng này" (fail nặng),
  // "thiếu tháng/năm" (fail - thực sự chưa điền) và "chỉ thiếu số ngày" (không tính lỗi -
  // nhiều văn bản cố tình để trống số ngày, chờ phần mềm ký số tự điền ngày ký vào đó).
  const diaDanhLooseRegex = /ngày\s*(\d{1,2})?\s*tháng\s*(\d{1,2})?\s*năm\s*(\d{4})?/i;
  const diaDanhIdx = findParagraphIndex(paragraphs, (t) => diaDanhLooseRegex.test(t));
  const diaDanhParagraph = diaDanhIdx >= 0 ? paragraphs[diaDanhIdx] : undefined;
  const diaDanhMatch = diaDanhParagraph ? normalize(diaDanhParagraph.text).match(diaDanhLooseRegex) : null;

  const dayMissing = !!diaDanhMatch && !diaDanhMatch[1];
  const missingRequiredParts: string[] = [];
  if (diaDanhMatch) {
    if (!diaDanhMatch[2]) missingRequiredParts.push("số tháng");
    if (!diaDanhMatch[3]) missingRequiredParts.push("năm");
  }
  const diaDanhComplete = !!diaDanhParagraph && missingRequiredParts.length === 0;

  const diaDanhFormatIssues: string[] = [];
  if (diaDanhComplete && diaDanhParagraph) {
    if (diaDanhParagraph.alignment !== "right") diaDanhFormatIssues.push("chưa canh phải");
    if (!paragraphIsItalic(diaDanhParagraph)) diaDanhFormatIssues.push("chưa in nghiêng");
  }

  let diaDanhStatus: RuleStatus;
  let diaDanhMessage: string;
  if (!diaDanhParagraph) {
    diaDanhStatus = "fail";
    diaDanhMessage = 'Không đạt: không tìm thấy dòng địa danh, ngày tháng ở đầu văn bản (dạng "..., ngày ... tháng ... năm ...").';
  } else if (!diaDanhComplete) {
    diaDanhStatus = "fail";
    diaDanhMessage = `Không đạt: dòng "${normalize(diaDanhParagraph.text).slice(0, 60)}" đang thiếu ${missingRequiredParts.join(", ")} - cần điền đầy đủ.`;
  } else if (dayMissing) {
    diaDanhStatus = "warning";
    diaDanhMessage =
      `Dòng "${normalize(diaDanhParagraph.text).slice(0, 60)}" đang để trống số ngày - hợp lý nếu văn bản chưa ký số (ngày ban hành sẽ được phần mềm ký số tự động điền). Cần kiểm tra lại sau khi ký số.` +
      (diaDanhFormatIssues.length > 0 ? ` Ngoài ra dòng này ${diaDanhFormatIssues.join(", ")}.` : "");
  } else if (diaDanhFormatIssues.length > 0) {
    diaDanhStatus = "warning";
    diaDanhMessage = `Đã điền đủ ngày tháng năm nhưng dòng này ${diaDanhFormatIssues.join(", ")}.`;
  } else {
    diaDanhStatus = "pass";
    diaDanhMessage = "Đạt: dòng địa danh, ngày tháng đầy đủ, nghiêng, canh phải.";
  }

  results.push({
    id: "dia_danh_ngay_thang",
    label: "Địa danh, ngày tháng năm ban hành",
    status: diaDanhStatus,
    message: diaDanhMessage,
    reference: REF_PHU_LUC_I,
  });

  // 9. Nơi nhận (thường nằm trong bảng 2 cột cùng khối chữ ký)
  const noiNhanIdx = findParagraphIndex(paragraphs, (t) => /n[ơo]i nh[ậa]n\s*:/i.test(t));
  results.push({
    id: "noi_nhan",
    label: '"Nơi nhận" cuối văn bản',
    status: noiNhanIdx >= 0 ? "pass" : "fail",
    message:
      noiNhanIdx >= 0
        ? "Đạt: có mục Nơi nhận."
        : 'Không đạt: không tìm thấy mục "Nơi nhận:" ở cuối văn bản.',
    reference: REF_PHU_LUC_I,
  });

  const score = Math.round(
    (results.filter((r) => r.status === "pass").length / results.length) * 100
  );
  const passed = results.every((r) => r.status !== "fail");

  return { docType: "cong_van", score, passed, results };
}
