import mammoth from "mammoth";
import pdf from "pdf-parse";
import { generateJson } from "@/lib/gemini";

export type ParsedCandidate = { full_name: string; email?: string; phone?: string; location?: string; headline?: string; summary?: string; skills: string[]; education: Array<{ degree?: string; institution?: string; field?: string; year?: string }>; experience: Array<{ title?: string; company?: string; start_date?: string; end_date?: string; highlights?: string[] }>; total_experience_months: number };
export async function extractText(file: Buffer, mime: string) {
  if (mime === "application/pdf") return (await pdf(file)).text;
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return (await mammoth.extractRawText({ buffer: file })).value;
  if (mime === "text/plain" || mime === "text/markdown" || mime === "text/rtf" || mime === "application/rtf") return file.toString("utf-8");
  if (mime === "application/octet-stream") {
    const text = file.toString("utf-8");
    if (text.includes("\n") || text.length < 5000) return text;
  }
  throw new Error("Only PDF, DOCX, TXT, MD, and RTF resumes are supported.");
}
export async function parseResume(text: string): Promise<ParsedCandidate> {
  const data = await generateJson<Partial<ParsedCandidate>>(`Resume:\n${text.slice(0, 50000)}`, "Extract resume facts only. Normalize degree names and skill names. Return a JSON object with full_name, email, phone, location, headline, summary, skills (string[]), education (array), experience (array), and total_experience_months (integer). Do not invent facts. Keep summary under 80 words and each experience entry to three short highlights maximum.");
  const months = data.total_experience_months;
  return { full_name: data.full_name || "Unknown candidate", skills: Array.isArray(data.skills) ? data.skills : [], education: Array.isArray(data.education) ? data.education : [], experience: Array.isArray(data.experience) ? data.experience : [], total_experience_months: typeof months === "number" && Number.isFinite(months) ? months : 0, email: data.email, phone: data.phone, location: data.location, headline: data.headline, summary: data.summary };
}
export function profileText(candidate: ParsedCandidate) {
  return [candidate.headline, candidate.summary, `Skills: ${candidate.skills.join(", ")}`, `Education: ${candidate.education.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(" ")).join("; ")}`, `Experience: ${candidate.experience.map((e) => [e.title, e.company, ...(e.highlights || [])].filter(Boolean).join(" ")).join("; ")}`, `${candidate.total_experience_months} months experience`].filter(Boolean).join("\n");
}
