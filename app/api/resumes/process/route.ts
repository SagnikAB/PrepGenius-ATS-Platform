import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedding } from "@/lib/gemini";
import { extractText, parseResume, profileText } from "@/lib/resume";
import { ensureUserProfile } from "@/lib/user-profile";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await ensureUserProfile(user); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not initialize user profile" }, { status: 500 }); }
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A resume file is required." }, { status: 400 });
  const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown", "text/rtf", "application/rtf", "application/octet-stream"];
  if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Upload a supported document under 10 MB." }, { status: 400 });
  const suffix = file.name.split(".").pop(); const path = `${user.id}/${crypto.randomUUID()}.${suffix}`;
  const { error: uploadError } = await supabase.storage.from("resumes").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
  const { data: candidate, error: candidateError } = await supabase.from("candidates").insert({ user_id: user.id, full_name: file.name.replace(/\.[^.]+$/, "") }).select("id").single();
  if (candidateError || !candidate) return NextResponse.json({ error: candidateError?.message || "Could not create candidate" }, { status: 500 });
  const { data: resume, error: resumeError } = await supabase.from("resumes").insert({ user_id: user.id, candidate_id: candidate.id, storage_path: path, original_filename: file.name, mime_type: file.type, processing_status: "processing" }).select("id").single();
  if (resumeError || !resume) return NextResponse.json({ error: resumeError?.message || "Could not create resume" }, { status: 500 });
  try {
    const text = await extractText(Buffer.from(await file.arrayBuffer()), file.type);
    const parsed = await parseResume(text); const profile = profileText(parsed); const vector = await embedding(profile);
    await supabase.from("candidates").update({ ...parsed, profile_text: profile, embedding: vector }).eq("id", candidate.id);
    await supabase.from("resumes").update({ extracted_text: text, processing_status: "completed" }).eq("id", resume.id);
    return NextResponse.json({ candidate: { id: candidate.id, full_name: parsed.full_name } });
  } catch (error) {
    await supabase.from("resumes").update({ processing_status: "failed", processing_error: error instanceof Error ? error.message : "Processing failed" }).eq("id", resume.id);
    return NextResponse.json({ error: "The file was saved, but parsing failed. Review the resume record and retry." }, { status: 422 });
  }
}
