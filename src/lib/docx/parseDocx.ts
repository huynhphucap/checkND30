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
  /** Toàn bộ đoạn văn theo đúng thứ tự xuất hiện trong tài liệu, kể cả nằm trong bảng. */
  paragraphs: DocxParagraph[];
  margins: DocxMargins;
  pageWidthMm?: number;
  pageHeightMm?: number;
  defaultFontFamily?: string;
  defaultFontSizePt?: number;
}

interface RunDefaults {
  fontFamily?: string;
  fontSizePt?: number;
}

// word/document.xml dùng đơn vị twip (1/20 pt) cho margin, 1pt = 1/72 inch.
const TWIP_TO_MM = 25.4 / 1440;
const HALF_POINT_TO_PT = 0.5;

// preserveOrder: true để giữ đúng thứ tự thật trong tài liệu - đoạn văn ở đầu công văn
// (quốc hiệu, tiêu ngữ, tên cơ quan) thường nằm trong 1 bảng 2 cột; nếu không giữ thứ tự
// thật, nội dung trong bảng sẽ bị dồn hết ra cuối, sai vị trí so với văn bản gốc.
// trimValues: false để không mất khoảng trắng đầu/cuối mỗi run - Word hay tách 1 câu
// thành nhiều run (do rà lỗi chính tả, theo dõi sửa đổi...), mất khoảng trắng ở ranh giới
// run sẽ làm dính chữ giữa 2 run lại với nhau.
const documentXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  trimValues: false,
});

// styles.xml chỉ cần tra cứu theo id, không cần giữ thứ tự.
const stylesXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => ["w:style"].includes(name),
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

// --- Helpers thao tác trên cây node dạng preserveOrder: mỗi node có dạng
// { [tagName]: children[], ":@"?: { "@_attr": value } }.

function tagOf(node: any): string {
  return Object.keys(node).find((k) => k !== ":@") ?? "";
}

function childrenOf(node: any): any[] {
  const value = node[tagOf(node)];
  return Array.isArray(value) ? value : [];
}

function attrOf(node: any, name: string): string | undefined {
  return node[":@"]?.[`@_${name}`];
}

function findChild(node: any, tag: string): any | undefined {
  return childrenOf(node).find((c: any) => tagOf(c) === tag);
}

function findChildren(node: any, tag: string): any[] {
  return childrenOf(node).filter((c: any) => tagOf(c) === tag);
}

function textOf(node: any): string {
  return childrenOf(node)
    .map((c: any) => (typeof c["#text"] === "string" ? c["#text"] : ""))
    .join("");
}

function boolAttr(node: any): boolean {
  const val = attrOf(node, "w:val");
  return val !== "0" && val !== "false";
}

function numAttrMm(node: any | undefined, attrName: string): number | undefined {
  const val = node ? attrOf(node, attrName) : undefined;
  return val !== undefined ? Number(val) * TWIP_TO_MM : undefined;
}

function extractRunText(runNode: any): string {
  return findChildren(runNode, "w:t")
    .map((t) => textOf(t))
    .join("");
}

function extractRunProps(runNode: any, defaults: RunDefaults): Omit<DocxRun, "text"> {
  const rPr = findChild(runNode, "w:rPr");
  if (!rPr) return { ...defaults };

  const rFonts = findChild(rPr, "w:rFonts");
  const fontFamily = rFonts
    ? (attrOf(rFonts, "w:ascii") ?? attrOf(rFonts, "w:eastAsia") ?? defaults.fontFamily)
    : defaults.fontFamily;

  const szNode = findChild(rPr, "w:sz");
  const szVal = szNode ? attrOf(szNode, "w:val") : undefined;
  const fontSizePt = szVal !== undefined ? Number(szVal) * HALF_POINT_TO_PT : defaults.fontSizePt;

  const bNode = findChild(rPr, "w:b");
  const iNode = findChild(rPr, "w:i");
  const capsNode = findChild(rPr, "w:caps");

  return {
    fontFamily,
    fontSizePt,
    bold: bNode ? boolAttr(bNode) : false,
    italic: iNode ? boolAttr(iNode) : false,
    uppercase: capsNode ? boolAttr(capsNode) : false,
  };
}

// Đọc word/styles.xml: mỗi named style (VD "Normal", "Kinhgui"...) có thể tự định nghĩa
// font/cỡ chữ riêng, và có thể kế thừa (w:basedOn) từ style khác. Khi 1 đoạn văn KHÔNG
// khai báo w:pStyle tường minh, Word vẫn ngầm định áp style mặc định (thường tên "Normal",
// đánh dấu w:default="1") - không phải docDefaults của cả file. Bỏ qua bước này sẽ đọc
// nhầm sang font mặc định toàn tài liệu dù style "Normal" thật sự set font khác.
type StyleMap = Map<string, { fontFamily?: string; fontSizePt?: number; basedOn?: string }>;

function parseStylesXml(styles: any): {
  styleMap: StyleMap;
  docDefaults: RunDefaults;
  defaultParagraphStyleId?: string;
} {
  const docDefaultsNode = styles["w:styles"]?.["w:docDefaults"]?.["w:rPrDefault"]?.["w:rPr"];
  const docDefaults: RunDefaults = {
    fontFamily: docDefaultsNode?.["w:rFonts"]?.["@_w:ascii"],
    fontSizePt: docDefaultsNode?.["w:sz"]?.["@_w:val"]
      ? Number(docDefaultsNode["w:sz"]["@_w:val"]) * HALF_POINT_TO_PT
      : undefined,
  };

  const styleMap: StyleMap = new Map();
  let defaultParagraphStyleId: string | undefined;

  for (const style of asArray(styles["w:styles"]?.["w:style"])) {
    const styleId = style["@_w:styleId"];
    if (!styleId) continue;
    const rPr = style["w:rPr"];
    styleMap.set(styleId, {
      fontFamily: rPr?.["w:rFonts"]?.["@_w:ascii"] ?? rPr?.["w:rFonts"]?.["@_w:eastAsia"],
      fontSizePt: rPr?.["w:sz"]?.["@_w:val"] ? Number(rPr["w:sz"]["@_w:val"]) * HALF_POINT_TO_PT : undefined,
      basedOn: style["w:basedOn"]?.["@_w:val"],
    });
    if (style["@_w:type"] === "paragraph" && style["@_w:default"] === "1") {
      defaultParagraphStyleId = styleId;
    }
  }

  return { styleMap, docDefaults, defaultParagraphStyleId };
}

function resolveStyleDefaults(
  explicitStyleId: string | undefined,
  defaultParagraphStyleId: string | undefined,
  styleMap: StyleMap,
  docDefaults: RunDefaults
): RunDefaults {
  const startId = explicitStyleId ?? defaultParagraphStyleId;
  if (!startId) return docDefaults;

  let fontFamily: string | undefined;
  let fontSizePt: number | undefined;
  const visited = new Set<string>();
  let current: string | undefined = startId;

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

function buildParagraph(
  pNode: any,
  defaults: RunDefaults,
  styleMap: StyleMap,
  defaultParagraphStyleId: string | undefined
): DocxParagraph {
  const pPr = findChild(pNode, "w:pPr");
  const jc = pPr ? findChild(pPr, "w:jc") : undefined;
  const alignment = jc ? attrOf(jc, "w:val") : undefined;
  const pStyleNode = pPr ? findChild(pPr, "w:pStyle") : undefined;
  const explicitStyleId = pStyleNode ? attrOf(pStyleNode, "w:val") : undefined;

  const paragraphDefaults = resolveStyleDefaults(explicitStyleId, defaultParagraphStyleId, styleMap, defaults);

  const runs: DocxRun[] = findChildren(pNode, "w:r").map((r) => ({
    text: extractRunText(r),
    ...extractRunProps(r, paragraphDefaults),
  }));

  return { text: runs.map((r) => r.text).join(""), alignment, runs };
}

// Duyệt các con trực tiếp của 1 container (body hoặc ô bảng) theo đúng thứ tự thật,
// đệ quy vào bảng lồng nhau để giữ nguyên trình tự đọc tự nhiên của văn bản.
function collectFromContainer(
  container: any,
  defaults: RunDefaults,
  styleMap: StyleMap,
  defaultParagraphStyleId: string | undefined,
  out: DocxParagraph[]
): void {
  for (const child of childrenOf(container)) {
    const tag = tagOf(child);
    if (tag === "w:p") {
      out.push(buildParagraph(child, defaults, styleMap, defaultParagraphStyleId));
    } else if (tag === "w:tbl") {
      for (const tr of findChildren(child, "w:tr")) {
        for (const tc of findChildren(tr, "w:tc")) {
          collectFromContainer(tc, defaults, styleMap, defaultParagraphStyleId, out);
        }
      }
    }
  }
}

export async function parseDocx(buffer: Buffer | ArrayBuffer): Promise<ParsedDocx> {
  const zip = await JSZip.loadAsync(buffer);

  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("File không đúng định dạng .docx (thiếu word/document.xml).");
  }
  const documentXml = await documentXmlFile.async("string");
  const parsedDoc = documentXmlParser.parse(documentXml);

  const stylesXmlFile = zip.file("word/styles.xml");
  let styleMap: StyleMap = new Map();
  let docDefaults: RunDefaults = {};
  let defaultParagraphStyleId: string | undefined;
  if (stylesXmlFile) {
    const stylesXml = await stylesXmlFile.async("string");
    const parsed = parseStylesXml(stylesXmlParser.parse(stylesXml));
    styleMap = parsed.styleMap;
    docDefaults = parsed.docDefaults;
    defaultParagraphStyleId = parsed.defaultParagraphStyleId;
  }

  const documentNode = (parsedDoc as any[]).find((n) => tagOf(n) === "w:document");
  const bodyNode = documentNode ? findChild(documentNode, "w:body") : undefined;
  if (!bodyNode) {
    throw new Error("File không đúng định dạng .docx (thiếu w:body).");
  }

  const paragraphs: DocxParagraph[] = [];
  collectFromContainer(bodyNode, docDefaults, styleMap, defaultParagraphStyleId, paragraphs);

  // Lấy margin/khổ giấy từ sectPr của body (áp dụng cho toàn tài liệu hoặc section cuối);
  // nếu không có, tìm sectPr lồng trong pPr của đoạn văn cuối cùng đánh dấu ngắt section.
  let sectPrNode = findChild(bodyNode, "w:sectPr");
  if (!sectPrNode) {
    const bodyParagraphs = findChildren(bodyNode, "w:p");
    for (let i = bodyParagraphs.length - 1; i >= 0; i--) {
      const pPr = findChild(bodyParagraphs[i], "w:pPr");
      const candidate = pPr ? findChild(pPr, "w:sectPr") : undefined;
      if (candidate) {
        sectPrNode = candidate;
        break;
      }
    }
  }

  const pgMar = sectPrNode ? findChild(sectPrNode, "w:pgMar") : undefined;
  const margins: DocxMargins = {
    topMm: numAttrMm(pgMar, "w:top"),
    bottomMm: numAttrMm(pgMar, "w:bottom"),
    leftMm: numAttrMm(pgMar, "w:left"),
    rightMm: numAttrMm(pgMar, "w:right"),
  };

  const pgSz = sectPrNode ? findChild(sectPrNode, "w:pgSz") : undefined;
  const pageWidthMm = numAttrMm(pgSz, "w:w");
  const pageHeightMm = numAttrMm(pgSz, "w:h");

  return {
    paragraphs,
    margins,
    pageWidthMm,
    pageHeightMm,
    defaultFontFamily: docDefaults.fontFamily,
    defaultFontSizePt: docDefaults.fontSizePt,
  };
}
