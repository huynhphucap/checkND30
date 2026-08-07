import { NextResponse } from "next/server";
import { parseDocx } from "@/lib/docx/parseDocx";
import { checkCongVan } from "@/lib/checkers/congvan";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { error: dbError } = await supabase.from("checks").insert({
      user_id: user.id,
      file_name: file.name,
      doc_type: report.docType,
      score: report.score,
      passed: report.passed,
      results: report.results,
    });
    if (dbError) {
      console.error("Không thể lưu lịch sử kiểm tra:", dbError.message);
    }
  }

  return NextResponse.json({ fileName: file.name, report });
}
