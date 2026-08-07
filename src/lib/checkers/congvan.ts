import type { ParsedDocx, DocxParagraph } from "@/lib/docx/parseDocx";
import type { CheckReport, RuleResult } from "./types";

const REF_PHU_LUC_I = "Nghị định 30/2020/NĐ-CP, Phụ lục I";

const MM_TOLERANCE = 1.5;

function inRange(value: number | undefined, min: number, max: number, tolerance = 0): boolean {
  if (value === undefined) return false;
  return value >= min - tolerance && value <= max + tolerance;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d");
}

function firstNonEmptyParagraphs(paragraphs: DocxParagraph[], count: number): DocxParagraph[] {
  return paragraphs.filter((p) => normalize(p.text).length > 0).slice(0, count);
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
  const { paragraphs, allParagraphs, margins, pageWidthMm, pageHeightMm } = doc;

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
  const nonTimesParagraphs = allParagraphs.filter((p) => {
    const fonts = paragraphFontFamilies(p);
    return fonts.length > 0 && fonts.some((f) => !f.toLowerCase().includes("times new roman"));
  });
  results.push({
    id: "font_family",
    label: "Phông chữ Times New Roman",
    status: nonTimesParagraphs.length === 0 ? "pass" : "fail",
    message:
      nonTimesParagraphs.length === 0
        ? "Đạt: toàn bộ văn bản dùng phông Times New Roman."
        : `Không đạt: có ${nonTimesParagraphs.length} đoạn dùng phông khác Times New Roman (VD: "${normalize(
            nonTimesParagraphs[0].text
          ).slice(0, 60)}").`,
    reference: REF_PHU_LUC_I,
  });

  // 4. Cỡ chữ nội dung 13-14pt
  const bodyParagraphs = allParagraphs.filter((p) => normalize(p.text).length > 15);
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
  const heading = firstNonEmptyParagraphs(paragraphs, 6);
  const quocHieuIdx = findParagraphIndex(heading, (t) =>
    stripDiacritics(t).toUpperCase().includes("CONG HOA XA HOI CHU NGHIA VIET NAM")
  );
  const quocHieu = quocHieuIdx >= 0 ? heading[quocHieuIdx] : undefined;
  const quocHieuOk =
    !!quocHieu &&
    quocHieu.alignment === "center" &&
    paragraphIsBold(quocHieu) &&
    normalize(quocHieu.text) === normalize(quocHieu.text).toUpperCase();
  results.push({
    id: "quoc_hieu",
    label: 'Quốc hiệu "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"',
    status: !quocHieu ? "fail" : quocHieuOk ? "pass" : "warning",
    message: !quocHieu
      ? "Không tìm thấy dòng Quốc hiệu trong phần đầu văn bản."
      : quocHieuOk
        ? "Đạt: Quốc hiệu in hoa, đậm, căn giữa."
        : "Tìm thấy dòng Quốc hiệu nhưng cần kiểm tra lại định dạng (in hoa/đậm/căn giữa).",
    reference: REF_PHU_LUC_I,
  });

  // 6. Tiêu ngữ
  const tieuNguIdx = findParagraphIndex(heading, (t) => {
    const s = stripDiacritics(t).toLowerCase();
    return s.includes("doc lap") && s.includes("tu do") && s.includes("hanh phuc");
  });
  const tieuNgu = tieuNguIdx >= 0 ? heading[tieuNguIdx] : undefined;
  const tieuNguOk = !!tieuNgu && tieuNgu.alignment === "center" && paragraphIsBold(tieuNgu);
  results.push({
    id: "tieu_ngu",
    label: 'Tiêu ngữ "Độc lập - Tự do - Hạnh phúc"',
    status: !tieuNgu ? "fail" : tieuNguOk ? "pass" : "warning",
    message: !tieuNgu
      ? "Không tìm thấy dòng Tiêu ngữ ngay dưới Quốc hiệu."
      : tieuNguOk
        ? "Đạt: Tiêu ngữ đậm, căn giữa, có gạch nối giữa các cụm từ."
        : "Tìm thấy Tiêu ngữ nhưng cần kiểm tra lại định dạng (đậm/căn giữa).",
    reference: REF_PHU_LUC_I,
  });

  // 7. Số, ký hiệu văn bản
  const soKyHieuIdx = findParagraphIndex(allParagraphs, (t) => /s[ốo]\s*:/i.test(t) || /^s[ốo]\s*\d/i.test(t));
  results.push({
    id: "so_ky_hieu",
    label: "Số, ký hiệu văn bản",
    status: soKyHieuIdx >= 0 ? "pass" : "fail",
    message:
      soKyHieuIdx >= 0
        ? `Đạt: tìm thấy dòng số ký hiệu ("${normalize(allParagraphs[soKyHieuIdx].text).slice(0, 60)}").`
        : 'Không đạt: không tìm thấy dòng "Số: .../..." trong văn bản.',
    reference: REF_PHU_LUC_I,
  });

  // 8. Địa danh, ngày tháng năm ban hành
  const diaDanhRegex = /ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}/i;
  const diaDanhIdx = findParagraphIndex(allParagraphs, (t) => diaDanhRegex.test(t));
  const diaDanhParagraph = diaDanhIdx >= 0 ? allParagraphs[diaDanhIdx] : undefined;
  const diaDanhOk =
    !!diaDanhParagraph && diaDanhParagraph.alignment === "right" && paragraphIsItalic(diaDanhParagraph);
  results.push({
    id: "dia_danh_ngay_thang",
    label: "Địa danh, ngày tháng năm ban hành",
    status: !diaDanhParagraph ? "fail" : diaDanhOk ? "pass" : "warning",
    message: !diaDanhParagraph
      ? 'Không đạt: không tìm thấy dòng địa danh, ngày tháng dạng "..., ngày ... tháng ... năm ...".'
      : diaDanhOk
        ? "Đạt: dòng địa danh, ngày tháng nghiêng, canh phải."
        : "Tìm thấy dòng địa danh, ngày tháng nhưng cần kiểm tra lại định dạng (nghiêng/canh phải).",
    reference: REF_PHU_LUC_I,
  });

  // 9. Nơi nhận (thường nằm trong bảng 2 cột cùng khối chữ ký)
  const noiNhanIdx = findParagraphIndex(allParagraphs, (t) => /n[ơo]i nh[ậa]n\s*:/i.test(t));
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
