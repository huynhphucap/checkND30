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
  /** Đoạn văn nằm trực tiếp trong body (không kể trong bảng) - theo đúng thứ tự văn bản. */
  paragraphs: DocxParagraph[];
  /** Toàn bộ đoạn văn, kể cả nằm trong bảng (VD: khối "Nơi nhận" / chữ ký thường đặt trong bảng 2 cột). */
  allParagraphs: DocxParagraph[];
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
  isArray: (name) => ["w:p", "w:r", "w:tbl", "w:tr", "w:tc", "w:style"].includes(name),
});

interface RunDefaults {
  fontFamily?: string;
  fontSizePt?: number;
}

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

function extractRunProps(run: any, defaults: RunDefaults): Omit<DocxRun, "text"> {
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

// Đọc word/styles.xml: mỗi named style (VD "Normal", "Kinhgui"...) có thể tự định nghĩa
// font/cỡ chữ riêng trong w:rPr của chính nó, và có thể kế thừa (w:basedOn) từ style khác.
// Nếu 1 đoạn văn tham chiếu style qua w:pStyle nhưng không set font trực tiếp trên run,
// font "thật" của đoạn đó là font của style - không phải font mặc định toàn tài liệu.
type StyleMap = Map<string, { fontFamily?: string; fontSizePt?: number; basedOn?: string }>;

function parseStylesXml(styles: any): { styleMap: StyleMap; docDefaults: RunDefaults } {
  const docDefaultsNode = styles["w:styles"]?.["w:docDefaults"]?.["w:rPrDefault"]?.["w:rPr"];
  const docDefaults: RunDefaults = {
    fontFamily: docDefaultsNode?.["w:rFonts"]?.["@_w:ascii"],
    fontSizePt: docDefaultsNode?.["w:sz"]?.["@_w:val"]
      ? Number(docDefaultsNode["w:sz"]["@_w:val"]) * HALF_POINT_TO_PT
      : undefined,
  };

  const styleMap: StyleMap = new Map();
  for (const style of asArray(styles["w:styles"]?.["w:style"])) {
    const styleId = style["@_w:styleId"];
    if (!styleId) continue;
    const rPr = style["w:rPr"];
    styleMap.set(styleId, {
      fontFamily: rPr?.["w:rFonts"]?.["@_w:ascii"] ?? rPr?.["w:rFonts"]?.["@_w:eastAsia"],
      fontSizePt: rPr?.["w:sz"]?.["@_w:val"] ? Number(rPr["w:sz"]["@_w:val"]) * HALF_POINT_TO_PT : undefined,
      basedOn: style["w:basedOn"]?.["@_w:val"],
    });
  }

  return { styleMap, docDefaults };
}

function resolveStyleDefaults(styleId: string | undefined, styleMap: StyleMap, docDefaults: RunDefaults): RunDefaults {
  if (!styleId) return docDefaults;

  let fontFamily: string | undefined;
  let fontSizePt: number | undefined;
  const visited = new Set<string>();
  let current: string | undefined = styleId;

  while (current && !visited.has(current)) {
    visited.add(current);
    const entry = styleMap.get(current);
    if (!entry) break;
    fontFamily ??= entry.fontFamily;
    fontSizePt ??= entry.fontSizePt;
    current = entry.basedOn;
  }

  return { fontFamily: fontFamily ?? docDefaults.fontFamily, fontSizePt: fontSizePt ?? docDefaults.fontSizePt };
}

function buildParagraph(p: any, defaults: RunDefaults, styleMap: StyleMap): DocxParagraph {
  const alignment = p["w:pPr"]?.["w:jc"]?.["@_w:val"];
  const pStyleId = p["w:pPr"]?.["w:pStyle"]?.["@_w:val"];
  const paragraphDefaults = resolveStyleDefaults(pStyleId, styleMap, defaults);

  const runNodes: any[] = asArray(p["w:r"]);
  const runs: DocxRun[] = runNodes.map((r) => ({
    text: extractRunText(r),
    ...extractRunProps(r, paragraphDefaults),
  }));
  return { text: runs.map((r) => r.text).join(""), alignment, runs };
}

// Đệ quy vì ô bảng (w:tc) có thể chứa bảng lồng nhau.
function collectTableParagraphs(
  tbl: any,
  defaults: RunDefaults,
  styleMap: StyleMap
): DocxParagraph[] {
  const result: DocxParagraph[] = [];
  for (const tr of asArray(tbl["w:tr"])) {
    for (const tc of asArray(tr["w:tc"])) {
      for (const p of asArray(tc["w:p"])) {
        result.push(buildParagraph(p, defaults, styleMap));
      }
      for (const nestedTbl of asArray(tc["w:tbl"])) {
        result.push(...collectTableParagraphs(nestedTbl, defaults, styleMap));
      }
    }
  }
  return result;
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
  let styleMap: StyleMap = new Map();
  let runDefaults: RunDefaults = {};
  if (stylesXmlFile) {
    const stylesXml = await stylesXmlFile.async("string");
    const parsed = parseStylesXml(xmlParser.parse(stylesXml));
    styleMap = parsed.styleMap;
    runDefaults = parsed.docDefaults;
  }
  const defaultFontFamily = runDefaults.fontFamily;
  const defaultFontSizePt = runDefaults.fontSizePt;

  const body = doc["w:document"]?.["w:body"] ?? {};
  const paragraphNodes: any[] = asArray(body["w:p"]);

  const paragraphs: DocxParagraph[] = paragraphNodes.map((p) => buildParagraph(p, runDefaults, styleMap));

  const tableParagraphs: DocxParagraph[] = asArray(body["w:tbl"]).flatMap((tbl) =>
    collectTableParagraphs(tbl, runDefaults, styleMap)
  );
  const allParagraphs: DocxParagraph[] = [...paragraphs, ...tableParagraphs];

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

  return { paragraphs, allParagraphs, margins, pageWidthMm, pageHeightMm, defaultFontFamily, defaultFontSizePt };
}
