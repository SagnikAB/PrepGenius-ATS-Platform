import { generateText } from "@/lib/gemini";

export type SkillCategory = "critical" | "important" | "nice-to-have";

export type SkillGap = {
  skill: string;
  category: SkillCategory;
  proficiencyLevel?: string;
  yearsRequired?: number;
};

export type RecommendedLearning = {
  skill: string;
  priority: number; // 1-10, where 10 is highest priority
  estimatedTime?: string;
  resources?: string[];
  rationale: string;
};

export type SkillGapAnalysis = {
  matchedSkills: string[];
  missingCriticalSkills: SkillGap[];
  missingImportantSkills: SkillGap[];
  missingNiceToHaveSkills: SkillGap[];
  recommendedLearnings: RecommendedLearning[];
  skillGapSummary: string;
  readinessPercentage: number;
};

/**
 * Parse job description to identify skill categories (critical, important, nice-to-have).
 * Returns a structured list of required skills with their category.
 */
function categorizeRequiredSkills(jobDescription: string): SkillGap[] {
  const criticalKeywords = [
    "must have", "required", "mandatory", "essential", "critical",
    "required skill", "core competency", "key responsibility",
  ];

  const importantKeywords = [
    "preferred", "desired", "strong", "experience with",
    "familiar with", "knowledge of",
  ];

  const lines = jobDescription.split("\n");
  const requiredSkills: SkillGap[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Detect category
    let category: SkillCategory = "nice-to-have";
    if (criticalKeywords.some((kw) => lowerLine.includes(kw))) {
      category = "critical";
    } else if (importantKeywords.some((kw) => lowerLine.includes(kw))) {
      category = "important";
    }

    // Extract skills (simple heuristic: capital words, known tech terms, etc.)
    const skillMatches = line.match(/\b[A-Z][a-zA-Z0-9+#.]*\b/g) || [];
    for (const skill of skillMatches) {
      const normalized = skill.toLowerCase();
      if (normalized.length > 2 && !seen.has(normalized)) {
        seen.add(normalized);
        requiredSkills.push({
          skill: skill.trim(),
          category,
        });
      }
    }
  }

  return requiredSkills;
}

/**
 * Identify matched skills between candidate skills and required job skills.
 */
export function identifyMatchedSkills(
  candidateSkills: string[] | null,
  requiredSkills: SkillGap[]
): string[] {
  if (!candidateSkills) return [];

  const candidateSkillsLower = candidateSkills.map((s) => s.toLowerCase());
  const matched: string[] = [];

  for (const required of requiredSkills) {
    for (const candidate of candidateSkillsLower) {
      if (
        candidate === required.skill.toLowerCase() ||
        candidate.includes(required.skill.toLowerCase()) ||
        required.skill.toLowerCase().includes(candidate)
      ) {
        matched.push(required.skill);
        break;
      }
    }
  }

  return [...new Set(matched)]; // Deduplicate
}

/**
 * Identify missing skills grouped by category (critical, important, nice-to-have).
 */
export function identifyMissingSkills(
  candidateSkills: string[] | null,
  requiredSkills: SkillGap[]
): {
  critical: SkillGap[];
  important: SkillGap[];
  niceToHave: SkillGap[];
} {
  const matched = identifyMatchedSkills(candidateSkills, requiredSkills);
  const matchedLower = matched.map((s) => s.toLowerCase());

  const missing = requiredSkills.filter((required) => {
    return !matchedLower.includes(required.skill.toLowerCase());
  });

  return {
    critical: missing.filter((s) => s.category === "critical"),
    important: missing.filter((s) => s.category === "important"),
    niceToHave: missing.filter((s) => s.category === "nice-to-have"),
  };
}

/**
 * Use Gemini to generate intelligent, prioritized learning recommendations.
 */
export async function generateLearningRecommendations(
  candidateSkills: string[] | null,
  missingSkills: SkillGap[],
  jobTitle: string,
  jobDescription: string,
  candidateExperience: number
): Promise<RecommendedLearning[]> {
  const fallback: RecommendedLearning[] = missingSkills.slice(0, 5).map((skill, idx) => ({
    skill: skill.skill,
    priority: Math.max(1, 10 - idx * 2),
    estimatedTime: "4-8 weeks",
    rationale: "Identified as missing skill based on job requirements.",
  }));

  if (!missingSkills || missingSkills.length === 0) {
    return [];
  }

  try {
    const prompt = `Job: ${jobTitle}\nJob Description (first 2000 chars): ${jobDescription.slice(0, 2000)}\n\nCandidate Current Skills: ${candidateSkills?.join(", ") || "None listed"}\nCandidate Experience: ${candidateExperience} months\n\nMissing Skills Required:\n${missingSkills.map((s) => `- ${s.skill} (${s.category})`).join("\n")}\n\nProvide a JSON array of 3-5 prioritized learning recommendations. Include skill name, priority (1-10), estimated time to learn, and clear rationale.`;

    const systemPrompt = `Return ONLY valid JSON array. Each item must have: {"skill":"string","priority":number,"estimatedTime":"string","resources":["string"],"rationale":"string"}. Prioritize critical skills first, then important. Consider the candidate's current experience level.`;

    const raw = await generateText(prompt, systemPrompt, 800, true);
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");

    try {
      const parsed = JSON.parse(cleaned) as Array<Partial<RecommendedLearning>>;
      return parsed
        .filter((item) => item.skill && typeof item.priority === "number")
        .slice(0, 10)
        .map((item) => ({
          skill: String(item.skill),
          priority: Math.max(1, Math.min(10, Math.round(Number(item.priority) || 5))),
          estimatedTime: String(item.estimatedTime || "4-8 weeks"),
          resources: Array.isArray(item.resources) ? item.resources : [],
          rationale: String(item.rationale || "Recommended based on job requirements."),
        }));
    } catch {
      return fallback;
    }
  } catch (error) {
    console.warn("Failed to generate learning recommendations:", error);
    return fallback;
  }
}

/**
 * Calculate readiness percentage: (matched skills / total required skills) * 100
 */
export function calculateReadinessPercentage(
  matchedCount: number,
  totalRequiredCount: number
): number {
  if (totalRequiredCount === 0) return 100;
  const percentage = Math.round((matchedCount / totalRequiredCount) * 100);
  return Math.max(0, Math.min(100, percentage));
}

/**
 * Generate a human-readable summary of the skill gap.
 */
export function generateSkillGapSummary(
  matchedCount: number,
  criticalMissingCount: number,
  importantMissingCount: number,
  readiness: number
): string {
  const parts: string[] = [];

  if (readiness >= 80) {
    parts.push(`Strong alignment (${readiness}% skill match).`);
  } else if (readiness >= 60) {
    parts.push(`Good alignment (${readiness}% skill match).`);
  } else if (readiness >= 40) {
    parts.push(`Moderate alignment (${readiness}% skill match).`);
  } else {
    parts.push(`Limited alignment (${readiness}% skill match).`);
  }

  if (criticalMissingCount > 0) {
    parts.push(`${criticalMissingCount} critical skill(s) to acquire.`);
  }

  if (importantMissingCount > 0) {
    parts.push(`${importantMissingCount} important skill(s) to develop.`);
  }

  if (matchedCount > 0) {
    parts.push(`${matchedCount} skills already match role requirements.`);
  }

  return parts.join(" ");
}

/**
 * Main analysis orchestrator: combines all gap analysis functions.
 */
export async function analyzeSkillGap(
  candidateSkills: string[] | null,
  jobDescription: string,
  jobTitle: string,
  candidateExperience: number
): Promise<SkillGapAnalysis> {
  // Step 1: Categorize required skills from job description
  const requiredSkills = categorizeRequiredSkills(jobDescription);

  // Step 2: Identify matched skills
  const matchedSkills = identifyMatchedSkills(candidateSkills, requiredSkills);

  // Step 3: Identify missing skills by category
  const { critical, important, niceToHave } = identifyMissingSkills(candidateSkills, requiredSkills);

  // Step 4: Calculate readiness
  const readinessPercentage = calculateReadinessPercentage(
    matchedSkills.length,
    requiredSkills.length
  );

  // Step 5: Generate learning recommendations
  const allMissing = [...critical, ...important, ...niceToHave];
  const recommendedLearnings = await generateLearningRecommendations(
    candidateSkills,
    allMissing,
    jobTitle,
    jobDescription,
    candidateExperience
  );

  // Step 6: Generate summary
  const skillGapSummary = generateSkillGapSummary(
    matchedSkills.length,
    critical.length,
    important.length,
    readinessPercentage
  );

  return {
    matchedSkills,
    missingCriticalSkills: critical,
    missingImportantSkills: important,
    missingNiceToHaveSkills: niceToHave,
    recommendedLearnings,
    skillGapSummary,
    readinessPercentage,
  };
}
