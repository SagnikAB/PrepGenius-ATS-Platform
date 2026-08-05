import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { embedding, generateText } from "@/lib/gemini";
import { ensureUserProfile } from "@/lib/user-profile";
const schema = z.object({ title: z.string().min(2).max(200), description: z.string().min(30).max(30000) });
type CandidateMatch = { id: string; full_name: string; headline: string | null; skills: string[] | null; total_experience_months: number; similarity: number };
export const maxDuration = 60;
export async function POST(request: Request) {
  const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await ensureUserProfile(user); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not initialize user profile" }, { status: 500 }); }
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Provide a title and a job description of at least 30 characters." }, { status: 400 });
  const vector = await embedding(`${parsed.data.title}\n${parsed.data.description}`);
  const { data: job, error } = await supabase.from("jobs").insert({ user_id: user.id, ...parsed.data, embedding: vector }).select("id").single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: candidates, error: matchError } = await supabase.rpc("match_candidates", { query_embedding: vector, match_count: 20 }); if (matchError) return NextResponse.json({ error: matchError.message }, { status: 400 });
  const results = await Promise.all(((candidates || []) as CandidateMatch[]).map(async (candidate) => {
    const prompt = `Job: ${parsed.data.title}\n${parsed.data.description}\n\nCandidate: ${candidate.headline || ""}; skills: ${(candidate.skills || []).join(", ")}; experience: ${candidate.total_experience_months} months.\nWrite 2 concise audit-ready sentences explaining relevant evidence only. State uncertainty or gaps plainly. Avoid protected characteristics and do not claim facts not supplied.`;
    const explanation = await generateText(prompt, "Write a concise two-sentence audit-ready explanation in plain text. Do not use JSON, Markdown, or a preamble.", 180, false);
    return { ...candidate, explanation };
  }));
  return NextResponse.json({ jobId: job.id, results });
}
