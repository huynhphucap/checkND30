// Cấu trúc XML của .docx (OOXML) không có type cố định khi parse động, nên dùng `any` có kiểm soát ở đây.
/* eslint-disable @typescript-eslint/no-explicit-any */
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export interface DocxRun {
  text: string;
  fontFamily?: string;
  fontSizePt?: number;
  bold?: boolean;
  italic?: boolean;
  uppercase?: boolean;
}

export interface DocxParagraph {
  text: string;
  alignment?: string;
  runs: DocxRun[];
}

export interface DocxMargins {
  topMm?: number;
  bottomMm?: number;
  leftMm?: number;
  rightMm?: number;
}

export interface ParsedDocx {
  paragraphs: DocxParagraph[];
  margins: DocxMargins;
  pageWidthMm?: number;
  pageHeightMm?: number;
  defaultFontFamily?: string;
  defaultFontSizePt?: number;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => ["w:p", "w:r", "w:tbl", "w:tr", "w:tc"].includes(name),
});

// word/document.xml dùng đơn vị twip (1/20 pt) cho margin, 1pt = 1/72 inch.
const TWIP_TO_MM = 25.4 / 1440;
const HALF_POINT_TO_PT = 0.5;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function extractRunText(run: any): string {
  const texts = asArray(run["w:t"]);
  return texts
    .map((t: any) => (typeof t === "object" ? (t["#text"] ?? "") : String(t ?? "")))
    .join("");
}

function extractRunProps(run: any, defaults: { fontFamily?: string; fontSizePt?: number }): Omit<DocxRun, "text"> {
  const rPr = run["w:rPr"];
  if (!rPr) return { ...defaults };

  const fontFamily =
    rPr["w:rFonts"]?.["@_w:ascii"] ??
    rPr["w:rFonts"]?.["@_w:eastAsia"] ??
    defaults.fontFamily;

  const sizeHalfPt = rPr["w:sz"]?.["@_w:val"];
  const fontSizePt = sizeHalfPt ? Number(sizeHalfPt) * HALF_POINT_TO_PT : defaults.fontSizePt;

  const bold = rPr["w:b"] !== undefined && rPr["w:b"]?.["@_w:val"] !== "0" && rPr["w:b"]?.["@_w:val"] !== "false";
  const italic = rPr["w:i"] !== undefined && rPr["w:i"]?.["@_w:val"] !== "0" && rPr["w:i"]?.["@_w:val"] !== "false";
  const caps = rPr["w:caps"] !== undefined && rPr["w:caps"]?.["@_w:val"] !== "0" && rPr["w:caps"]?.["@_w:val"] !== "false";

  return { fontFamily, fontSizePt, bold, italic, uppercase: caps };
}

export async function parseDocx(buffer: Buffer | ArrayBuffer): Promise<ParsedDocx> {
  const zip = await JSZip.loadAsync(buffer);

  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("File không đúng định dạng .docx (thiếu word/document.xml).");
  }
  const documentXml = await documentXmlFile.async("string");
  const doc = xmlParser.parse(documentXml);

  const stylesXmlFile = zip.file("word/styles.xml");
  let defaultFontFamily: string | undefined;
  let defaultFontSizePt: number | undefined;
  if (stylesXmlFile) {
    const stylesXml = await stylesXmlFile.async("string");
    const styles = xmlParser.parse(stylesXml);
    const docDefaults = styles["w:styles"]?.["w:docDefaults"]?.["w:rPrDefault"]?.["w:rPr"];
    defaultFontFamily = docDefaults?.["w:rFonts"]?.["@_w:ascii"];
    const sizeHalfPt = docDefaults?.["w:sz"]?.["@_w:val"];
    defaultFontSizePt = sizeHalfPt ? Number(sizeHalfPt) * HALF_POINT_TO_PT : undefined;
  }

  const body = doc["w:document"]?.["w:body"] ?? {};
  const paragraphNodes: any[] = asArray(body["w:p"]);

  const paragraphs: DocxParagraph[] = paragraphNodes.map((p) => {
    const alignment = p["w:pPr"]?.["w:jc"]?.["@_w:val"];
    const runNodes: any[] = asArray(p["w:r"]);
    const runs: DocxRun[] = runNodes.map((r) => ({
      text: extractRunText(r),
      ...extractRunProps(r, { fontFamily: defaultFontFamily, fontSizePt: defaultFontSizePt }),
    }));
    return {
      text: runs.map((r) => r.text).join(""),
      alignment,
      runs,
    };
  });

  // Lấy margin/khổ giấy từ sectPr cuối cùng (áp dụng cho toàn bộ hoặc section cuối).
  let sectPr = body["w:sectPr"];
  if (!sectPr) {
    for (let i = paragraphNodes.length - 1; i >= 0; i--) {
      const candidate = paragraphNodes[i]["w:pPr"]?.["w:sectPr"];
      if (candidate) {
        sectPr = candidate;
        break;
      }
    }
  }

  const pgMar = sectPr?.["w:pgMar"];
  const margins: DocxMargins = {
    topMm: pgMar?.["@_w:top"] !== undefined ? Number(pgMar["@_w:top"]) * TWIP_TO_MM : undefined,
    bottomMm: pgMar?.["@_w:bottom"] !== undefined ? Number(pgMar["@_w:bottom"]) * TWIP_TO_MM : undefined,
    leftMm: pgMar?.["@_w:left"] !== undefined ? Number(pgMar["@_w:left"]) * TWIP_TO_MM : undefined,
    rightMm: pgMar?.["@_w:right"] !== undefined ? Number(pgMar["@_w:right"]) * TWIP_TO_MM : undefined,
  };

  const pgSz = sectPr?.["w:pgSz"];
  const pageWidthMm = pgSz?.["@_w:w"] !== undefined ? Number(pgSz["@_w:w"]) * TWIP_TO_MM : undefined;
  const pageHeightMm = pgSz?.["@_w:h"] !== undefined ? Number(pgSz["@_w:h"]) * TWIP_TO_MM : undefined;

  return { paragraphs, margins, pageWidthMm, pageHeightMm, defaultFontFamily, defaultFontSizePt };
}
