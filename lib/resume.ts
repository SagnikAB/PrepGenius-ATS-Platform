import mammoth from "mammoth";
import pdf from "pdf-parse";
import { generateJson, type GeminiSchema } from "@/lib/gemini";
import { checkATSFormatting, type ATSFormattingReport } from "@/lib/ats-formatter-checker";

export type ParsedCandidate = { full_name: string; email?: string; phone?: string; location?: string; headline?: string; summary?: string; skills: string[]; education: Array<{ degree?: string; institution?: string; field?: string; year?: string }>; experience: Array<{ title?: string; company?: string; start_date?: string; end_date?: string; highlights?: string[] }>; total_experience_months: number };

const resumeExtractionSchema: GeminiSchema = {
  type: "OBJECT",
  additionalProperties: false,
  properties: {
    full_name: { type: "STRING" },
    email: { type: "STRING" },
    phone: { type: "STRING" },
    location: { type: "STRING" },
    headline: { type: "STRING" },
    summary: { type: "STRING" },
    skills: { type: "ARRAY", items: { type: "STRING" } },
    education: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        additionalProperties: false,
        properties: {
          degree: { type: "STRING" },
          institution: { type: "STRING" },
          field: { type: "STRING" },
          year: { type: "STRING" },
        },
      },
    },
    experience: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        additionalProperties: false,
        properties: {
          title: { type: "STRING" },
          company: { type: "STRING" },
          start_date: { type: "STRING" },
          end_date: { type: "STRING" },
          highlights: { type: "ARRAY", items: { type: "STRING" } },
        },
      },
    },
    total_experience_months: { type: "INTEGER" },
  },
  required: ["full_name", "skills", "education", "experience", "total_experience_months"],
};
export function anonymizePII(text: string): string {
  let anonymized = text;

  // Anonymize email addresses: name@domain.com → [EMAIL]
  anonymized = anonymized.replace(/[\w\.\-+]+@[\w\.\-]+\.\w+/g, "[EMAIL]");

  // Anonymize phone numbers: various international formats
  anonymized = anonymized.replace(/(\+\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/g, "[PHONE]");
  anonymized = anonymized.replace(/\+\d{1,3}\s\d{1,14}/g, "[PHONE]");

  // Anonymize social media and contact handles (LinkedIn, GitHub URLs, etc.)
  anonymized = anonymized.replace(/(linkedin\.com\/in\/[\w\-]+|github\.com\/[\w\-]+)/gi, "[CONTACT_PROFILE]");

  // Anonymize names prefixed with common headers (Name:, Applicant:, Candidate:, Author:, etc.)
  // Match "Name: John Doe" or "APPLICANT\nJohn Doe" patterns
  anonymized = anonymized.replace(/(?:^|\n)\s*(?:Name|Candidate|Applicant|Author|Contact)[\s:]+([^\n]+)/gim, "\n[CANDIDATE_NAME]");

  return anonymized;
}

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
  const anonymizedText = anonymizePII(text);
  const data = await generateJson<Partial<ParsedCandidate>>(`Resume:\n${anonymizedText.slice(0, 50000)}`, "Extract resume facts only. Normalize degree names and skill names. Return a JSON object with full_name, email, phone, location, headline, summary, skills (string[]), education (array), experience (array), and total_experience_months (integer). Do not invent facts. Keep summary under 80 words and each experience entry to three short highlights maximum. For anonymized sections marked [EMAIL], [PHONE], [CANDIDATE_NAME], infer reasonable placeholder values or leave empty.", resumeExtractionSchema);
  const months = data.total_experience_months;
  return { full_name: data.full_name || "Unknown candidate", skills: Array.isArray(data.skills) ? data.skills : [], education: Array.isArray(data.education) ? data.education : [], experience: Array.isArray(data.experience) ? data.experience : [], total_experience_months: typeof months === "number" && Number.isFinite(months) ? months : 0, email: data.email, phone: data.phone, location: data.location, headline: data.headline, summary: data.summary };
}

export async function parseResumeWithATS(text: string): Promise<ParsedCandidate & { atsFormatting: ATSFormattingReport }> {
  const candidate = await parseResume(text);
  const atsFormatting = checkATSFormatting(text);
  return { ...candidate, atsFormatting };
}
export function profileText(candidate: ParsedCandidate) {
  return [candidate.headline, candidate.summary, `Skills: ${candidate.skills.join(", ")}`, `Education: ${candidate.education.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(" ")).join("; ")}`, `Experience: ${candidate.experience.map((e) => [e.title, e.company, ...(e.highlights || [])].filter(Boolean).join(" ")).join("; ")}`, `${candidate.total_experience_months} months experience`].filter(Boolean).join("\n");
}
