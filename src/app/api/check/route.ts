import { NextResponse } from "next/server";
import { parseDocx } from "@/lib/docx/parseDocx";
import { checkCongVan } from "@/lib/checkers/congvan";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file để kiểm tra." }, { status: 400 });
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File rỗng hoặc vượt quá 10MB." },
      { status: 400 }
    );
  }

  const isDocx =
    file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
  if (!isDocx) {
    return NextResponse.json(
      { error: "Chỉ hỗ trợ file .docx (Word)." },
      { status: 400 }
    );
  }

  let report;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseDocx(buffer);
    report = checkCongVan(parsed);
  } catch (err) {
    console.error("Lỗi khi phân tích file docx:", err);
    return NextResponse.json(
      { error: "Không thể đọc file .docx. Vui lòng kiểm tra lại file." },
      { status: 422 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (idToken) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      await getAdminDb()
        .collection("checks")
        .add({
          userId: decoded.uid,
          userEmail: decoded.email ?? null,
          fileName: file.name,
          docType: report.docType,
          score: report.score,
          passed: report.passed,
          results: report.results,
          createdAt: new Date(),
        });
    } catch (err) {
      console.error("Không thể lưu lịch sử kiểm tra:", err);
    }
  }

  return NextResponse.json({ fileName: file.name, report });
}
