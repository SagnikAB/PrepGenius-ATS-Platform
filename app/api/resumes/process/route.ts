import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedding } from "@/lib/gemini";
import { extractText, parseResumeWithATS, profileText } from "@/lib/resume";
import { ensureUserProfile } from "@/lib/user-profile";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureUserProfile(user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not initialize user profile" }, { status: 500 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A resume file is required." }, { status: 400 });
  const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown", "text/rtf", "application/rtf"];
  if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Upload a supported document under 10 MB." }, { status: 400 });
  const suffix = file.name.split(".").pop()?.toLowerCase();
  if (!suffix || !["pdf", "docx", "txt", "md", "rtf"].includes(suffix)) return NextResponse.json({ error: "Upload a PDF, DOCX, TXT, MD, or RTF resume." }, { status: 400 });

  const path = `${user.id}/${crypto.randomUUID()}.${suffix}`;
  const { error: uploadError } = await supabase.storage.from("resumes").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const removeStoredFile = async () => {
    await supabase.storage.from("resumes").remove([path]);
  };

  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .insert({ user_id: user.id, full_name: file.name.replace(/\.[^.]+$/, "") })
    .select("id")
    .single();
  if (candidateError || !candidate) {
    await removeStoredFile();
    return NextResponse.json({ error: candidateError?.message || "Could not create candidate" }, { status: 500 });
  }

  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .insert({ user_id: user.id, candidate_id: candidate.id, storage_path: path, original_filename: file.name, mime_type: file.type, processing_status: "processing" })
    .select("id")
    .single();
  if (resumeError || !resume) {
    await supabase.from("candidates").delete().eq("id", candidate.id);
    await removeStoredFile();
    return NextResponse.json({ error: resumeError?.message || "Could not create resume" }, { status: 500 });
  }

  try {
    const text = (await extractText(Buffer.from(await file.arrayBuffer()), file.type)).slice(0, 200_000);
    const parsed = await parseResumeWithATS(text);
    const profile = profileText(parsed);
    const vector = await embedding(profile);
    const { error: candidateUpdateError } = await supabase.from("candidates").update({ ...parsed, profile_text: profile, embedding: vector }).eq("id", candidate.id);
    if (candidateUpdateError) throw new Error(`Could not save candidate profile: ${candidateUpdateError.message}`);
    const { error: resumeUpdateError } = await supabase.from("resumes").update({ extracted_text: text, ats_formatting_report: parsed.atsFormatting, processing_status: "completed" }).eq("id", resume.id);
    if (resumeUpdateError) throw new Error(`Could not save processed resume: ${resumeUpdateError.message}`);
    return NextResponse.json({ candidate: { id: candidate.id, full_name: parsed.full_name }, ats: parsed.atsFormatting });
  } catch (error) {
    const processingError = error instanceof Error ? error.message : "Processing failed";
    const { error: failureUpdateError } = await supabase.from("resumes").update({ processing_status: "failed", processing_error: processingError }).eq("id", resume.id);
    if (failureUpdateError) return NextResponse.json({ error: `Processing failed and its status could not be saved: ${failureUpdateError.message}` }, { status: 500 });
    return NextResponse.json({ error: "The file was saved, but parsing failed. Review the resume record and retry." }, { status: 422 });
  }
}
