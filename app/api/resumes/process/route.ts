import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedding } from "@/lib/gemini";
import { extractText, parseMultipleResumes, profileText } from "@/lib/resume";
import { ensureUserProfile } from "@/lib/user-profile";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureUserProfile(user);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not initialize user profile" },
      { status: 500 }
    );
  }

  const form = await request.formData();
  const rawFiles = [...form.getAll("file"), ...form.getAll("files")].filter(
    (item): item is File => item instanceof File
  );

  if (rawFiles.length === 0) {
    return NextResponse.json({ error: "At least one resume file is required." }, { status: 400 });
  }

  const processedCandidates: Array<{ id: string; full_name: string; original_filename: string }> = [];
  const errors: string[] = [];

  for (const file of rawFiles) {
    if (file.size > 10 * 1024 * 1024) {
      errors.push(`${file.name}: Exceeds 10 MB limit.`);
      continue;
    }

    const suffix = file.name.split(".").pop()?.toLowerCase();
    if (!suffix || !["pdf", "docx", "txt", "md", "rtf"].includes(suffix)) {
      errors.push(`${file.name}: Unsupported file format. Please upload PDF, DOCX, TXT, MD, or RTF.`);
      continue;
    }

    const path = `${user.id}/${crypto.randomUUID()}.${suffix}`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });

    if (uploadError) {
      errors.push(`${file.name}: Storage upload failed (${uploadError.message}).`);
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extractedRawText = (await extractText(buffer, file.type, file.name)).slice(0, 200_000);
      const parsedCandidates = await parseMultipleResumes(extractedRawText, file.name);

      for (const parsed of parsedCandidates) {
        const { data: candidate, error: candidateError } = await supabase
          .from("candidates")
          .insert({
            user_id: user.id,
            full_name: parsed.full_name,
            headline: parsed.headline,
            summary: parsed.summary,
            skills: parsed.skills,
            education: parsed.education,
            experience: parsed.experience,
            total_experience_months: parsed.total_experience_months,
          })
          .select("id")
          .single();

        if (candidateError || !candidate) {
          errors.push(`${file.name}: Could not save candidate record (${candidateError?.message}).`);
          continue;
        }

        let { data: resume, error: resumeError } = await supabase
          .from("resumes")
          .insert({
            user_id: user.id,
            candidate_id: candidate.id,
            storage_path: path,
            original_filename: file.name,
            mime_type: file.type || "application/octet-stream",
            extracted_text: extractedRawText,
            ats_formatting_report: parsed.atsFormatting,
            processing_status: "completed",
          })
          .select("id")
          .single();

        if (resumeError && (resumeError.message.includes("ats_formatting_report") || resumeError.code === "PGRST204")) {
          const fallback = await supabase
            .from("resumes")
            .insert({
              user_id: user.id,
              candidate_id: candidate.id,
              storage_path: path,
              original_filename: file.name,
              mime_type: file.type || "application/octet-stream",
              extracted_text: extractedRawText,
              processing_status: "completed",
            })
            .select("id")
            .single();

          resume = fallback.data;
          resumeError = fallback.error;
        }

        if (resumeError || !resume) {
          errors.push(`${file.name}: Resume record creation failed (${resumeError?.message}).`);
          continue;
        }

        // Generate vector embedding for semantic search
        try {
          const profileStr = profileText(parsed);
          const vector = await embedding(profileStr);
          await supabase
            .from("candidates")
            .update({ profile_text: profileStr, embedding: vector })
            .eq("id", candidate.id);
        } catch (embedError) {
          console.warn(`Vector embedding failed for ${parsed.full_name}:`, embedError);
        }

        processedCandidates.push({
          id: candidate.id,
          full_name: parsed.full_name,
          original_filename: file.name,
        });
      }
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : "Processing failed.";
      errors.push(`${file.name}: ${msg}`);
    }
  }

  if (processedCandidates.length === 0) {
    return NextResponse.json(
      { error: errors.join(" ") || "No resumes could be parsed." },
      { status: 422 }
    );
  }

  const firstCandidate = processedCandidates[0];
  return NextResponse.json({
    success: true,
    processedCount: processedCandidates.length,
    candidates: processedCandidates,
    errors,
    // Backward compatibility for single resume callers
    candidate: { id: firstCandidate.id, full_name: firstCandidate.full_name },
  });
}

