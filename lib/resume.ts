import mammoth from "mammoth";
import pdf from "pdf-parse";
import { generateJson, type GeminiSchema } from "@/lib/gemini";
import { checkATSFormatting, type ATSFormattingReport } from "@/lib/ats-formatter-checker";

export type ParsedCandidate = { full_name: string; email?: string; phone?: string; location?: string; headline?: string; summary?: string; skills: string[]; education: Array<{ degree?: string; institution?: string; field?: string; year?: string }>; experience: Array<{ title?: string; company?: string; start_date?: string; end_date?: string; highlights?: string[] }>; total_experience_months: number };

const MAX_RESUME_CHARS = 50_000;
const MAX_SKILLS = 60;
const SKILL_PATTERNS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Ruby", "PHP", "Kotlin", "Swift", "SQL",
  "React", "Next.js", "Node.js", "Angular", "Vue", "Express", "Django", "Flask", "FastAPI", "Spring Boot",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Git", "GitHub Actions", "Jenkins",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Kafka", "GraphQL", "REST", "gRPC",
  "HTML", "CSS", "Tailwind", "Figma", "Jest", "Cypress", "Playwright", "Machine Learning", "TensorFlow", "PyTorch",
  "Pandas", "NumPy", "Tableau", "Power BI", "Excel", "Salesforce", "Supabase",
];

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

function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  return cleaned || undefined;
}

function uniqueStrings(values: unknown[], max = MAX_SKILLS): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanString(value, 100);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
    if (result.length === max) break;
  }
  return result;
}

function extractContactDetails(text: string) {
  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/i)?.[0];
  const phone = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]\d{3,4}/)?.[0]?.trim();
  const named = text.match(/(?:^|\n)\s*(?:name|candidate|applicant)\s*:\s*([^\n]+)/i)?.[1];
  const firstCandidateLine = text.split("\n").map((line) => line.trim()).find((line) =>
    /^[A-Za-z][A-Za-z .'-]{2,70}$/.test(line) && !/^(resume|curriculum vitae|profile|contact)$/i.test(line)
  );
  return { email, phone, fullName: cleanString(named ?? firstCandidateLine, 100) };
}

function extractKnownSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return SKILL_PATTERNS.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\./g, "[.]?");
    return new RegExp(`(^|[^a-z0-9+#])${escaped.toLowerCase()}($|[^a-z0-9+#])`, "i").test(lower);
  });
}

function parseDateMonth(value: unknown): number | null {
  const text = cleanString(value, 50)?.toLowerCase();
  if (!text) return null;
  if (/present|current|now/.test(text)) return new Date().getFullYear() * 12 + new Date().getMonth();
  const match = text.match(/(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?\s*[,./-]?\s*((?:19|20)\d{2})/i);
  if (!match) return null;
  const year = Number(match[1]);
  const monthName = text.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)?.[0]?.slice(0, 3);
  const month = monthName ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthName.toLowerCase()) : 0;
  return year * 12 + Math.max(0, month);
}

function estimateExperienceMonths(experience: ParsedCandidate["experience"]): number {
  const ranges = experience.map((entry) => ({ start: parseDateMonth(entry.start_date), end: parseDateMonth(entry.end_date) }))
    .filter((range): range is { start: number; end: number } => range.start !== null && range.end !== null && range.end >= range.start)
    .sort((a, b) => a.start - b.start);
  if (!ranges.length) return 0;
  let total = 0;
  let start = ranges[0].start;
  let end = ranges[0].end;
  for (const range of ranges.slice(1)) {
    if (range.start <= end + 1) end = Math.max(end, range.end);
    else { total += end - start + 1; start = range.start; end = range.end; }
  }
  return Math.min(600, total + end - start + 1);
}

function normalizeCandidate(data: Partial<ParsedCandidate>, contact: ReturnType<typeof extractContactDetails>, knownSkills: string[]): ParsedCandidate {
  const education = Array.isArray(data.education) ? data.education.slice(0, 10).map((entry) => ({
    degree: cleanString(entry?.degree, 150), institution: cleanString(entry?.institution, 200), field: cleanString(entry?.field, 150), year: cleanString(entry?.year, 20),
  })) : [];
  const experience = Array.isArray(data.experience) ? data.experience.slice(0, 15).map((entry) => ({
    title: cleanString(entry?.title, 150), company: cleanString(entry?.company, 150), start_date: cleanString(entry?.start_date, 50), end_date: cleanString(entry?.end_date, 50),
    highlights: uniqueStrings(Array.isArray(entry?.highlights) ? entry.highlights : [], 3),
  })) : [];
  const modelMonths = Number(data.total_experience_months);
  const estimatedMonths = estimateExperienceMonths(experience);
  return {
    full_name: contact.fullName ?? cleanString(data.full_name, 100) ?? "Unknown candidate",
    email: contact.email ?? cleanString(data.email, 254),
    phone: contact.phone ?? cleanString(data.phone, 50),
    location: cleanString(data.location, 150),
    headline: cleanString(data.headline, 200),
    summary: cleanString(data.summary, 700),
    skills: uniqueStrings([...(Array.isArray(data.skills) ? data.skills : []), ...knownSkills]),
    education,
    experience,
    total_experience_months: Number.isFinite(modelMonths) && modelMonths >= 0 && modelMonths <= 600 ? Math.round(modelMonths) : estimatedMonths,
  };
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
  const cleanedText = cleanText(text);
  if (cleanedText.length < 40) throw new Error("The document does not contain enough readable text to parse as a resume.");
  const contact = extractContactDetails(cleanedText);
  const knownSkills = extractKnownSkills(cleanedText);
  const anonymizedText = anonymizePII(cleanedText);
  const data = await generateJson<Partial<ParsedCandidate>>(
    `Resume:\n${anonymizedText.slice(0, MAX_RESUME_CHARS)}`,
    "Extract only facts supported by the resume. Do not infer placeholder contact data for [EMAIL], [PHONE], or [CANDIDATE_NAME]. Normalize skills and degrees. Return concise structured JSON with full_name, email, phone, location, headline, summary, skills, education, experience, and total_experience_months. Keep the summary below 80 words and no more than three highlights for each role.",
    resumeExtractionSchema
  );
  return normalizeCandidate(data, contact, knownSkills);
}

export async function parseResumeWithATS(text: string): Promise<ParsedCandidate & { atsFormatting: ATSFormattingReport }> {
  const candidate = await parseResume(text);
  const atsFormatting = checkATSFormatting(text);
  return { ...candidate, atsFormatting };
}
export function profileText(candidate: ParsedCandidate) {
  return [candidate.headline, candidate.summary, `Skills: ${candidate.skills.join(", ")}`, `Education: ${candidate.education.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(" ")).join("; ")}`, `Experience: ${candidate.experience.map((e) => [e.title, e.company, ...(e.highlights || [])].filter(Boolean).join(" ")).join("; ")}`, `${candidate.total_experience_months} months experience`].filter(Boolean).join("\n");
}
