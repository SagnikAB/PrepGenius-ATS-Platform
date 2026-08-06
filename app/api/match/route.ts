import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { embedding, generateText } from "@/lib/gemini";
import { ensureUserProfile } from "@/lib/user-profile";
import { hybridMatch, reRankBySimilarity } from "@/lib/hybrid-matcher";
import { analyzeSkillGap, type SkillGapAnalysis } from "@/lib/skill-gap-analyzer";

const schema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().min(30).max(30000),
});

type JobInput = z.infer<typeof schema>;

// The RPC currently returns these fields. education / resume_text / projects
// are treated as optional because they may not yet exist in match_candidates;
// every helper below degrades gracefully when they are missing.
type CandidateMatch = {
  id: string;
  full_name: string;
  headline: string | null;
  skills: string[] | null;
  total_experience_months: number;
  similarity: number;
  education?: string | null;
  resume_text?: string | null;
  projects?: string | null;
};

type ScoreBreakdown = {
  skills: number;
  experience: number;
  projects: number;
  education: number;
  keywords: number;
  semantic: number;
  formatting: number;
};

type CandidateResult = CandidateMatch & {
  overallScore: number;
  scoreBreakdown: ScoreBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  explanation: string;
  skillGapAnalysis?: SkillGapAnalysis;
};

type SemanticEvaluation = {
  semanticScore: number;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  projectRelevance: number;
  communicationScore: number;
};

type ProjectsEvaluation = {
  projectsScore: number;
  complexity: number;
  relevance: number;
  technologiesUsed: string[];
  businessImpact: string;
};

type EducationEvaluation = {
  educationScore: number;
  reasoning: string;
};

const WEIGHTS = {
  skills: 0.3,
  experience: 0.2,
  projects: 0.15,
  keywords: 0.1,
  education: 0.1,
  semantic: 0.1,
  formatting: 0.05,
} as const;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "are", "will", "have", "has",
  "this", "that", "from", "into", "our", "their", "who", "what", "when",
  "where", "why", "how", "job", "role", "team", "work", "working", "able",
  "ability", "years", "year", "experience", "including", "such", "etc",
  "responsibilities", "requirements", "requirement", "must", "should",
  "can", "using", "used", "use", "well", "strong", "good", "great", "we",
  "they", "them", "its", "about", "across", "within", "per", "not", "any",
  "all", "one", "two", "three", "new", "other", "than", "also", "plus",
  "looking", "candidate", "candidates", "company", "position",
]);

const SKILL_DICTIONARY = [
  "javascript", "typescript", "python", "java", "c++", "c#", "go", "golang",
  "rust", "ruby", "php", "kotlin", "swift", "scala", "sql", "nosql",
  "react", "react.js", "next.js", "nextjs", "vue", "angular", "svelte",
  "node.js", "nodejs", "express", "nestjs", "django", "flask", "fastapi",
  "spring", "spring boot", "rails", "laravel", ".net", "asp.net",
  "graphql", "rest", "grpc", "microservices", "docker", "kubernetes",
  "aws", "azure", "gcp", "terraform", "ansible", "ci/cd", "jenkins",
  "github actions", "gitlab ci", "postgresql", "mysql", "mongodb", "redis",
  "elasticsearch", "kafka", "rabbitmq", "supabase", "firebase", "html",
  "css", "tailwind", "tailwindcss", "sass", "webpack", "vite", "jest",
  "cypress", "playwright", "testing", "unit testing", "tdd", "agile",
  "scrum", "git", "linux", "bash", "shell", "machine learning", "deep learning",
  "tensorflow", "pytorch", "pandas", "numpy", "data science", "nlp",
  "computer vision", "llm", "gemini", "openai", "langchain", "vector database",
  "pgvector", "embedding", "embeddings", "system design", "distributed systems",
  "api design", "security", "oauth", "jwt", "figma", "ui/ux", "accessibility",
  "performance optimization", "web sockets", "websockets", "cloud architecture",
];

export const maxDuration = 60;
const MAX_MATCH_CANDIDATES = 10;
const SCORING_CONCURRENCY = 2;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = normalize(value);
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
      out.push(value.trim());
    }
  }
  return out;
}

function clampScore(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  worker: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await worker(values[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, runWorker));
  return results;
}

function extractYearsRequired(description: string): number | null {
  const rangeMatch = description.match(/(\d+)\s*(?:-|to)\s*(\d+)\+?\s*years?/i);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    if (!Number.isNaN(low) && !Number.isNaN(high)) return Math.min(low, high);
  }
  const singleMatch = description.match(/(\d+)\+?\s*years?/i);
  if (singleMatch) {
    const years = parseInt(singleMatch[1], 10);
    if (!Number.isNaN(years)) return years;
  }
  return null;
}

function extractKeywords(text: string, limit = 25): string[] {
  const tokens = text
    .toLowerCase()
    .match(/[a-z0-9+#.]{3,}/g) ?? [];

  const frequency = new Map<string, number>();
  for (const token of tokens) {
    const cleaned = token.replace(/\.+$/, "");
    if (cleaned.length < 3 || STOPWORDS.has(cleaned)) continue;
    if (/^\d+$/.test(cleaned)) continue;
    frequency.set(cleaned, (frequency.get(cleaned) ?? 0) + 1);
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

function calculateSkillsScore(
  candidateSkills: string[] | null,
  jobDescription: string
): { skillsScore: number; matchedSkills: string[]; missingSkills: string[] } {
  const jdLower = jobDescription.toLowerCase();
  const requiredSkills = dedupe(
    SKILL_DICTIONARY.filter((skill) => jdLower.includes(skill))
  );

  const safeCandidateSkills = dedupe(candidateSkills ?? []);
  const candidateSkillsLower = safeCandidateSkills.map(normalize);

  if (requiredSkills.length === 0) {
    // JD did not surface recognizable skills; fall back to a neutral score
    // rather than penalizing the candidate for an ambiguous description.
    return {
      skillsScore: safeCandidateSkills.length > 0 ? 70 : 40,
      matchedSkills: safeCandidateSkills,
      missingSkills: [],
    };
  }

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const required of requiredSkills) {
    const isMatch = candidateSkillsLower.some(
      (candidateSkill) =>
        candidateSkill === required ||
        candidateSkill.includes(required) ||
        required.includes(candidateSkill)
    );
    if (isMatch) {
      matchedSkills.push(required);
    } else {
      missingSkills.push(required);
    }
  }

  const skillsScore = clampScore(
    (matchedSkills.length / requiredSkills.length) * 100
  );

  return { skillsScore, matchedSkills, missingSkills };
}

function calculateExperienceScore(
  totalExperienceMonths: number | null | undefined,
  jobDescription: string
): { experienceScore: number; requiredYears: number | null; candidateYears: number } {
  const safeMonths = typeof totalExperienceMonths === "number" && totalExperienceMonths > 0
    ? totalExperienceMonths
    : 0;
  const candidateYears = Math.round((safeMonths / 12) * 10) / 10;
  const requiredYears = extractYearsRequired(jobDescription);

  if (requiredYears === null || requiredYears <= 0) {
    return { experienceScore: candidateYears > 0 ? 80 : 50, requiredYears, candidateYears };
  }

  if (candidateYears >= requiredYears) {
    return { experienceScore: 100, requiredYears, candidateYears };
  }

  const experienceScore = clampScore((candidateYears / requiredYears) * 100);
  return { experienceScore, requiredYears, candidateYears };
}

function calculateKeywordScore(
  jobDescription: string,
  candidate: CandidateMatch
): { keywordScore: number; matchedKeywords: string[]; missingKeywords: string[] } {
  const keywords = extractKeywords(jobDescription);
  const candidateText = normalize(
    [candidate.headline ?? "", (candidate.skills ?? []).join(" "), candidate.resume_text ?? ""].join(" ")
  );

  if (keywords.length === 0) {
    return { keywordScore: 60, matchedKeywords: [], missingKeywords: [] };
  }

  const matchedKeywords = keywords.filter((keyword) => candidateText.includes(keyword));
  const missingKeywords = keywords.filter((keyword) => !candidateText.includes(keyword));

  const keywordScore = clampScore((matchedKeywords.length / keywords.length) * 100);
  return { keywordScore, matchedKeywords, missingKeywords };
}

function calculateFormattingScore(candidate: CandidateMatch): number {
  let score = 100;
  if (!candidate.headline || candidate.headline.trim().length === 0) score -= 20;
  if (!candidate.skills || candidate.skills.length === 0) score -= 25;
  if (!candidate.total_experience_months || candidate.total_experience_months <= 0) score -= 20;
  if (!candidate.resume_text || candidate.resume_text.trim().length === 0) score -= 20;
  return clampScore(score);
}

function calculateFinalScore(breakdown: ScoreBreakdown): number {
  const weighted =
    breakdown.skills * WEIGHTS.skills +
    breakdown.experience * WEIGHTS.experience +
    breakdown.projects * WEIGHTS.projects +
    breakdown.keywords * WEIGHTS.keywords +
    breakdown.education * WEIGHTS.education +
    breakdown.semantic * WEIGHTS.semantic +
    breakdown.formatting * WEIGHTS.formatting;
  return clampScore(weighted);
}

function parseGeminiJSON<T>(raw: string): T | null {
  const attemptParse = (input: string): T | null => {
    try {
      return JSON.parse(input) as T;
    } catch {
      return null;
    }
  };

  const direct = attemptParse(raw.trim());
  if (direct) return direct;

  const fencedMatch = raw.match(/```json([\s\S]*?)```/i) ?? raw.match(/```([\s\S]*?)```/);
  if (fencedMatch) {
    const fromFence = attemptParse(fencedMatch[1].trim());
    if (fromFence) return fromFence;
  }

  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    const fromBraces = attemptParse(braceMatch[0]);
    if (fromBraces) return fromBraces;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Gemini-backed helpers (all wrapped so failures degrade instead of crashing)
// ---------------------------------------------------------------------------

async function getSemanticEvaluation(
  job: JobInput,
  candidate: CandidateMatch
): Promise<SemanticEvaluation> {
  const fallback: SemanticEvaluation = {
    semanticScore: clampScore(candidate.similarity * 100),
    strengths: [],
    weaknesses: [],
    missingSkills: [],
    projectRelevance: clampScore(candidate.similarity * 100),
    communicationScore: 60,
  };

  try {
    const prompt = `Job title: ${job.title}\nJob description: ${job.description}\n\nCandidate headline: ${candidate.headline ?? "N/A"}\nCandidate skills: ${(candidate.skills ?? []).join(", ") || "N/A"}\nCandidate experience: ${candidate.total_experience_months ?? 0} months\nCandidate resume excerpt: ${(candidate.resume_text ?? "").slice(0, 4000)}`;

    const systemPrompt = `Return ONLY valid JSON, no preamble, no markdown fences. Use exactly this shape: {"semanticScore":number 0-100,"strengths":string[],"weaknesses":string[],"missingSkills":string[],"projectRelevance":number 0-100,"communicationScore":number 0-100}. Base every field strictly on the supplied text, never invent facts, and never reference protected characteristics.`;

    const raw = await generateText(prompt, systemPrompt, 500, true);
    const parsed = parseGeminiJSON<Partial<SemanticEvaluation>>(raw);
    if (!parsed) return fallback;

    return {
      semanticScore: clampScore(Number(parsed.semanticScore ?? fallback.semanticScore)),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 10) : fallback.strengths,
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 10) : fallback.weaknesses,
      missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.slice(0, 10) : fallback.missingSkills,
      projectRelevance: clampScore(Number(parsed.projectRelevance ?? fallback.projectRelevance)),
      communicationScore: clampScore(Number(parsed.communicationScore ?? fallback.communicationScore)),
    };
  } catch {
    return fallback;
  }
}

async function getProjectsEvaluation(
  job: JobInput,
  candidate: CandidateMatch
): Promise<ProjectsEvaluation> {
  const fallback: ProjectsEvaluation = {
    projectsScore: candidate.projects ? 55 : 40,
    complexity: 50,
    relevance: 50,
    technologiesUsed: [],
    businessImpact: "Not enough project detail available to assess business impact.",
  };

  if (!candidate.projects || candidate.projects.trim().length === 0) {
    return fallback;
  }

  try {
    const prompt = `Job title: ${job.title}\nJob description: ${job.description}\n\nCandidate project history: ${candidate.projects.slice(0, 4000)}`;

    const systemPrompt = `Return ONLY valid JSON, no preamble, no markdown fences. Use exactly this shape: {"projectsScore":number 0-100,"complexity":number 0-100,"relevance":number 0-100,"technologiesUsed":string[],"businessImpact":string}. Judge complexity, relevance to the job, technologies used, and business impact strictly from the supplied text.`;

    const raw = await generateText(prompt, systemPrompt, 400, true);
    const parsed = parseGeminiJSON<Partial<ProjectsEvaluation>>(raw);
    if (!parsed) return fallback;

    return {
      projectsScore: clampScore(Number(parsed.projectsScore ?? fallback.projectsScore)),
      complexity: clampScore(Number(parsed.complexity ?? fallback.complexity)),
      relevance: clampScore(Number(parsed.relevance ?? fallback.relevance)),
      technologiesUsed: Array.isArray(parsed.technologiesUsed) ? parsed.technologiesUsed.slice(0, 15) : fallback.technologiesUsed,
      businessImpact: typeof parsed.businessImpact === "string" ? parsed.businessImpact : fallback.businessImpact,
    };
  } catch {
    return fallback;
  }
}

async function getEducationEvaluation(
  job: JobInput,
  candidate: CandidateMatch
): Promise<EducationEvaluation> {
  const fallback: EducationEvaluation = {
    educationScore: 50,
    reasoning: "Education data was not available for evaluation.",
  };

  if (candidate.education && candidate.education.trim().length > 0) {
    const educationLower = candidate.education.toLowerCase();
    const jdLower = job.description.toLowerCase();
    const degreeLevels = ["phd", "doctorate", "master", "msc", "mba", "bachelor", "bsc", "b.tech", "m.tech", "associate"];
    const jdMentionsDegree = degreeLevels.some((level) => jdLower.includes(level));
    const candidateMentionsDegree = degreeLevels.some((level) => educationLower.includes(level));

    if (!jdMentionsDegree) {
      return { educationScore: 80, reasoning: "Job description does not specify a required degree; candidate education is a bonus." };
    }
    if (candidateMentionsDegree) {
      return { educationScore: 90, reasoning: "Candidate education aligns with degree expectations mentioned in the job description." };
    }
    return { educationScore: 55, reasoning: "Candidate has education history, but it does not clearly match the JD's stated requirement." };
  }

  try {
    const prompt = `Job title: ${job.title}\nJob description: ${job.description}\n\nCandidate headline: ${candidate.headline ?? "N/A"}\nCandidate resume excerpt: ${(candidate.resume_text ?? "").slice(0, 3000)}`;

    const systemPrompt = `Return ONLY valid JSON, no preamble, no markdown fences. Use exactly this shape: {"educationScore":number 0-100,"reasoning":string}. If no education signal can be found in the supplied text, return a moderate score around 50 and say so in reasoning.`;

    const raw = await generateText(prompt, systemPrompt, 250, true);
    const parsed = parseGeminiJSON<Partial<EducationEvaluation>>(raw);
    if (!parsed) return fallback;

    return {
      educationScore: clampScore(Number(parsed.educationScore ?? fallback.educationScore)),
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : fallback.reasoning,
    };
  } catch {
    return fallback;
  }
}

function buildExplanation(
  candidate: CandidateMatch,
  overallScore: number,
  semantic: SemanticEvaluation
): string {
  const topStrength = semantic.strengths[0];
  const topWeakness = semantic.weaknesses[0];

  const strengthSentence = topStrength
    ? `Strongest evidence: ${topStrength}.`
    : `Overall fit score is ${overallScore}/100 based on skills, experience, and project alignment.`;

  const weaknessSentence = topWeakness
    ? `Main gap: ${topWeakness}.`
    : `No major gaps were identified from the available candidate data.`;

  return `${strengthSentence} ${weaknessSentence}`;
}

async function scoreCandidate(
  job: JobInput,
  candidate: CandidateMatch
): Promise<CandidateResult> {
  const { skillsScore, matchedSkills, missingSkills } = calculateSkillsScore(
    candidate.skills,
    job.description
  );
  const { experienceScore } = calculateExperienceScore(
    candidate.total_experience_months,
    job.description
  );
  const { keywordScore } = calculateKeywordScore(job.description, candidate);
  const formattingScore = calculateFormattingScore(candidate);

  const [semantic, projects, education, skillGapAnalysis] = await Promise.all([
    getSemanticEvaluation(job, candidate),
    getProjectsEvaluation(job, candidate),
    getEducationEvaluation(job, candidate),
    analyzeSkillGap(candidate.skills, job.description, job.title, candidate.total_experience_months),
  ]);

  const scoreBreakdown: ScoreBreakdown = {
    skills: skillsScore,
    experience: experienceScore,
    projects: projects.projectsScore,
    education: education.educationScore,
    keywords: keywordScore,
    semantic: semantic.semanticScore,
    formatting: formattingScore,
  };

  const overallScore = calculateFinalScore(scoreBreakdown);

  const combinedMissingSkills = dedupe([...missingSkills, ...semantic.missingSkills]);

  return {
    ...candidate,
    overallScore,
    scoreBreakdown,
    matchedSkills,
    missingSkills: combinedMissingSkills,
    strengths: semantic.strengths,
    weaknesses: semantic.weaknesses,
    explanation: buildExplanation(candidate, overallScore, semantic),
    skillGapAnalysis,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = schema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a title and a job description of at least 30 characters." },
      { status: 400 }
    );
  }

  let vector: number[];
  try {
    vector = await embedding(`${parsed.data.title}\n${parsed.data.description}`);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate job embedding." },
      { status: 502 }
    );
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ user_id: user.id, ...parsed.data, embedding: vector })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: candidates, error: matchError } = await supabase.rpc("match_candidates", {
    query_embedding: vector,
    match_count: MAX_MATCH_CANDIDATES,
  });
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 400 });

  const safeCandidates = (candidates ?? []) as CandidateMatch[];

  // Apply hybrid matching: re-rank pgvector results using skill vector similarity
  let hybridResult;
  try {
    hybridResult = await hybridMatch(
      vector,
      safeCandidates,
      parsed.data.title,
      parsed.data.description,
      0.25, // Similarity threshold: keep candidates with >25% skill match
      20
    );
  } catch (hybridError) {
    // If hybrid matching fails, fall back to original pgvector ordering
    console.warn("Hybrid matching failed, using pgvector ordering:", hybridError);
    hybridResult = null;
  }

  // Re-rank candidates based on hybrid matching if available
  let rankedCandidates = safeCandidates;
  if (hybridResult && hybridResult.topVectorMatches.length > 0) {
    rankedCandidates = reRankBySimilarity(safeCandidates, hybridResult.topVectorMatches);
  }

  const results = await mapWithConcurrency(rankedCandidates, SCORING_CONCURRENCY, async (candidate) => {
      try {
        return await scoreCandidate(parsed.data, candidate);
      } catch (scoringError) {
        // A single candidate failing to score should never take down the
        // whole match request; fall back to a minimal, honest result.
        const formattingScore = calculateFormattingScore(candidate);
        const scoreBreakdown: ScoreBreakdown = {
          skills: 0,
          experience: 0,
          projects: 0,
          education: 0,
          keywords: 0,
          semantic: clampScore(candidate.similarity * 100),
          formatting: formattingScore,
        };
        return {
          ...candidate,
          overallScore: calculateFinalScore(scoreBreakdown),
          scoreBreakdown,
          matchedSkills: [],
          missingSkills: [],
          strengths: [],
          weaknesses: [],
          explanation:
            scoringError instanceof Error
              ? `Scoring incomplete for this candidate: ${scoringError.message}`
              : "Scoring incomplete for this candidate due to an unexpected error.",
          skillGapAnalysis: undefined,
        } satisfies CandidateResult;
      }
  });

  results.sort((a, b) => b.overallScore - a.overallScore);

  return NextResponse.json({ jobId: job.id, results });
}
