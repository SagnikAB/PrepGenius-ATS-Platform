import mammoth from "mammoth";
import pdf from "pdf-parse";
import { generateJson, type GeminiSchema } from "@/lib/gemini";
import { checkATSFormatting, type ATSFormattingReport } from "@/lib/ats-formatter-checker";

export type ParsedCandidate = {
  full_name: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  skills: string[];
  education: Array<{ degree?: string; institution?: string; field?: string; year?: string }>;
  experience: Array<{ title?: string; company?: string; start_date?: string; end_date?: string; highlights?: string[] }>;
  total_experience_months: number;
};

const MAX_RESUME_CHARS = 50_000;
const MAX_SKILLS = 60;
const SKILL_PATTERNS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Ruby", "PHP", "Kotlin", "Swift", "SQL",
  "React", "Next.js", "Node.js", "Angular", "Vue", "Express", "Django", "Flask", "FastAPI", "Spring Boot",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Git", "GitHub Actions", "Jenkins",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Kafka", "GraphQL", "REST", "gRPC",
  "HTML", "CSS", "Tailwind", "Figma", "Jest", "Cypress", "Playwright", "Machine Learning", "TensorFlow", "PyTorch",
  "Pandas", "NumPy", "Tableau", "Power BI", "Excel", "Salesforce", "Supabase", "GitLab", "CI/CD", "PHP",
  "R programming language", "SAS", "R Studio",
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
  anonymized = anonymized.replace(/[\w\.\-+]+@[\w\.\-]+\.\w+/g, "[EMAIL]");
  anonymized = anonymized.replace(/(\+\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/g, "[PHONE]");
  anonymized = anonymized.replace(/\+\d{1,3}\s\d{1,14}/g, "[PHONE]");
  anonymized = anonymized.replace(/(linkedin\.com\/in\/[\w\-]+|github\.com\/[\w\-]+)/gi, "[CONTACT_PROFILE]");
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

const SECTION_HEADER_REGEX = /^(resume|curriculum vitae|cv|profile|contact|summary|professional summary|work experience|experience|employment|education|skills|technical skills|objective|career objective|executive summary|personal details|about me|projects|key projects|certifications)$/i;

function extractContactDetails(text: string) {
  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/i)?.[0];
  const phone = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]\d{3,4}/)?.[0]?.trim();
  const named = text.match(/(?:^|\n)\s*(?:name|candidate|applicant)\s*:\s*([^\n]+)/i)?.[1];

  const candidateLines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  const firstCandidateLine = candidateLines.find((line) => {
    if (SECTION_HEADER_REGEX.test(line)) return false;
    if (/^(page \d|http|www|email|phone)/i.test(line)) return false;
    return /^[A-Z][A-Za-z .'-]{1,50}$/.test(line);
  });

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
  const ranges = experience
    .map((entry) => ({ start: parseDateMonth(entry.start_date), end: parseDateMonth(entry.end_date) }))
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

function normalizeCandidate(
  data: Partial<ParsedCandidate>,
  contact: ReturnType<typeof extractContactDetails>,
  knownSkills: string[],
  fallbackName = "Unknown candidate"
): ParsedCandidate {
  const education = Array.isArray(data.education) ? data.education.slice(0, 10).map((entry) => ({
    degree: cleanString(entry?.degree, 150),
    institution: cleanString(entry?.institution, 200),
    field: cleanString(entry?.field, 150),
    year: cleanString(entry?.year, 20),
  })) : [];

  const experience = Array.isArray(data.experience) ? data.experience.slice(0, 15).map((entry) => ({
    title: cleanString(entry?.title, 150),
    company: cleanString(entry?.company, 150),
    start_date: cleanString(entry?.start_date, 50),
    end_date: cleanString(entry?.end_date, 50),
    highlights: uniqueStrings(Array.isArray(entry?.highlights) ? entry.highlights : [], 3),
  })) : [];

  const rawLLMName = cleanString(data.full_name, 100);
  const isInvalidLLMName = !rawLLMName || /^\[?candidate[ _]?name\]?$/i.test(rawLLMName) || /unknown candidate/i.test(rawLLMName) || SECTION_HEADER_REGEX.test(rawLLMName);

  const fullName = !isInvalidLLMName
    ? rawLLMName
    : (contact.fullName && !SECTION_HEADER_REGEX.test(contact.fullName)
      ? contact.fullName
      : fallbackName);

  const modelMonths = Number(data.total_experience_months);
  const estimatedMonths = estimateExperienceMonths(experience);

  return {
    full_name: fullName,
    email: cleanString(data.email, 254) ?? contact.email,
    phone: cleanString(data.phone, 50) ?? contact.phone,
    location: cleanString(data.location, 150),
    headline: cleanString(data.headline, 200),
    summary: cleanString(data.summary, 700),
    skills: uniqueStrings([...(Array.isArray(data.skills) ? data.skills : []), ...knownSkills]),
    education,
    experience,
    total_experience_months: Number.isFinite(modelMonths) && modelMonths >= 0 && modelMonths <= 600 ? Math.round(modelMonths) : estimatedMonths,
  };
}

export async function extractText(file: Buffer, mime: string, filename?: string): Promise<string> {
  const ext = filename ? filename.split(".").pop()?.toLowerCase() : "";

  // Check magic bytes for PDF (%PDF)
  const isPDF = mime === "application/pdf" || ext === "pdf" || file.slice(0, 4).toString() === "%PDF";
  if (isPDF) {
    try {
      const pdfData = await pdf(file);
      if (pdfData.text && pdfData.text.trim().length > 0) {
        return pdfData.text;
      }
    } catch (e) {
      console.warn("PDF extraction attempt warning:", e);
    }
  }

  // Check magic bytes for DOCX (PK zip header 0x50 0x4B 0x03 0x04)
  const isDocx = mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext === "docx" || (file[0] === 0x50 && file[1] === 0x4b);
  if (isDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer: file });
      if (result.value && result.value.trim().length > 0) {
        return result.value;
      }
    } catch (e) {
      console.warn("DOCX extraction attempt warning:", e);
    }
  }

  // Text/Markdown/RTF check
  if (mime === "text/plain" || mime === "text/markdown" || mime === "text/rtf" || mime === "application/rtf" || ext === "txt" || ext === "md" || ext === "rtf") {
    return file.toString("utf-8");
  }

  if (mime === "application/octet-stream" || !mime) {
    const text = file.toString("utf-8");
    if (text.includes("\n") || text.length < 5000) return text;
  }

  // Fallback: try raw text reading
  const rawText = file.toString("utf-8");
  if (rawText && !rawText.includes("\0") && rawText.length > 20) {
    return rawText;
  }

  throw new Error("Only PDF, DOCX, TXT, MD, and RTF resumes are supported.");
}

export async function parseResume(text: string, defaultName?: string): Promise<ParsedCandidate> {
  const cleanedText = cleanText(text);
  if (cleanedText.length < 30) {
    throw new Error("The document does not contain enough readable text to parse as a resume.");
  }

  const contact = extractContactDetails(cleanedText);
  const knownSkills = extractKnownSkills(cleanedText);
  const fallbackCandidateName = defaultName || contact.fullName || "Candidate";

  try {
    const data = await generateJson<Partial<ParsedCandidate>>(
      `Resume Document:\n${cleanedText.slice(0, MAX_RESUME_CHARS)}`,
      "Extract structured candidate information supported by the resume text. Return clean JSON with full_name, email, phone, location, headline, summary, skills, education, experience, and total_experience_months.",
      resumeExtractionSchema
    );
    return normalizeCandidate(data, contact, knownSkills, fallbackCandidateName);
  } catch (llmError) {
    console.warn("LLM resume extraction failed or timed out, using rule-based parsing fallback:", llmError);
    return normalizeCandidate(
      {
        full_name: contact.fullName || fallbackCandidateName,
        email: contact.email,
        phone: contact.phone,
        skills: knownSkills,
        summary: cleanedText.slice(0, 300),
      },
      contact,
      knownSkills,
      fallbackCandidateName
    );
  }
}

export async function parseResumeWithATS(text: string, defaultName?: string): Promise<ParsedCandidate & { atsFormatting: ATSFormattingReport }> {
  const candidate = await parseResume(text, defaultName);
  const atsFormatting = checkATSFormatting(text);
  return { ...candidate, atsFormatting };
}

/**
 * Splits and parses documents containing either a single resume or multiple concatenated resumes (bulk resume scan).
 */
export async function parseMultipleResumes(
  text: string,
  filename?: string
): Promise<Array<ParsedCandidate & { atsFormatting: ATSFormattingReport }>> {
  const cleaned = cleanText(text);
  const defaultBaseName = filename ? filename.replace(/\.[^.]+$/, "") : "Candidate";

  // Check if document contains explicit split indicators or multiple distinct candidates
  const splits = cleaned
    .split(/(?:\n\s*[-=_]{4,}\s*\n|\f|\n\s*\[RESUME_SPLIT\]\s*\n)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 50);

  if (splits.length > 1) {
    const results: Array<ParsedCandidate & { atsFormatting: ATSFormattingReport }> = [];
    for (let i = 0; i < splits.length; i++) {
      const candidateName = `${defaultBaseName} (${i + 1})`;
      const parsed = await parseResumeWithATS(splits[i], candidateName);
      results.push(parsed);
    }
    return results;
  }

  // Single resume case
  const single = await parseResumeWithATS(cleaned, defaultBaseName);
  return [single];
}

export function profileText(candidate: ParsedCandidate) {
  return [
    candidate.headline,
    candidate.summary,
    `Skills: ${candidate.skills.join(", ")}`,
    `Education: ${candidate.education.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(" ")).join("; ")}`,
    `Experience: ${candidate.experience.map((e) => [e.title, e.company, ...(e.highlights || [])].filter(Boolean).join(" ")).join("; ")}`,
    `${candidate.total_experience_months} months experience`,
  ]
    .filter(Boolean)
    .join("\n");
}

