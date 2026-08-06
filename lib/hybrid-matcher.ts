import { embedding } from "@/lib/gemini";

export type VectorMatch = {
  candidateId: string;
  candidateName: string;
  similarity: number;
  matchedSkills: string[];
  skillSimilarityScore: number;
};

export type HybridMatchResult = {
  jobId: string;
  queryEmbedding: number[];
  topVectorMatches: VectorMatch[];
  vectorFilterApplied: boolean;
  similarityThreshold: number;
};

/**
 * Cosinе similarity between two vectors (normalized dot product).
 * Both vectors must have the same length.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`);
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Generate an embedding for a skill string.
 * Useful for pre-computing skill vectors for fast similarity comparison.
 */
export async function generateSkillEmbedding(skillText: string): Promise<number[]> {
  return embedding(skillText);
}

/**
 * Compare multiple candidate skill sets against job description skills using vector similarity.
 * Returns top matches sorted by similarity score.
 */
export async function computeSkillVectorSimilarity(
  jobSkillText: string,
  candidates: Array<{
    id: string;
    name: string;
    skills: string[];
  }>,
  topK = 20
): Promise<VectorMatch[]> {
  try {
    // Generate embedding for job skills
    const jobEmbedding = await generateSkillEmbedding(jobSkillText);

    // Generate embeddings for candidate skills and compute similarity
    const results: VectorMatch[] = [];

    for (const candidate of candidates) {
      const candidateSkillsText = candidate.skills.join(", ");
      
      try {
        const candidateEmbedding = await generateSkillEmbedding(candidateSkillsText);
        const similarity = cosineSimilarity(jobEmbedding, candidateEmbedding);

        // Estimate matched skills (skills that appear in both)
        const jobSkillsSet = new Set(jobSkillText.toLowerCase().split(/[,\s]+/).filter(Boolean));
        const matchedSkills = candidate.skills.filter((skill) =>
          jobSkillsSet.has(skill.toLowerCase()) || 
          jobSkillText.toLowerCase().includes(skill.toLowerCase())
        );

        results.push({
          candidateId: candidate.id,
          candidateName: candidate.name,
          similarity,
          matchedSkills,
          skillSimilarityScore: Math.round(similarity * 100),
        });
      } catch (error) {
        // If embedding fails for a single candidate, log and continue
        console.warn(`Failed to compute skill similarity for candidate ${candidate.id}:`, error);
      }
    }

    // Sort by similarity descending and return top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  } catch (error) {
    console.error("Failed to compute skill vector similarity:", error);
    return [];
  }
}

/**
 * Hybrid matching orchestrator:
 * 1. Use pgvector in Supabase to get initial candidates
 * 2. Re-rank using skill vector embeddings
 * 3. Filter by similarity threshold if desired
 * Returns top candidates for semantic scoring by Gemini.
 */
export async function hybridMatch(
  jobEmbedding: number[],
  candidates: Array<{
    id: string;
    full_name: string;
    skills: string[] | null;
    similarity: number; // from pgvector similarity already
  }>,
  jobTitle: string,
  jobDescription: string,
  similarityThreshold = 0.3,
  topK = 20
): Promise<HybridMatchResult> {
  const jobSkillText = `${jobTitle} ${jobDescription}`;

  // Convert candidates to skill vector format
  const candidatesForSkillMatch = candidates.map((c) => ({
    id: c.id,
    name: c.full_name,
    skills: c.skills ?? [],
  }));

  // Compute skill-based vector similarity
  const skillMatches = await computeSkillVectorSimilarity(
    jobSkillText,
    candidatesForSkillMatch,
    topK
  );

  // Filter by similarity threshold
  const filteredMatches = similarityThreshold
    ? skillMatches.filter((m) => m.similarity >= similarityThreshold)
    : skillMatches;

  return {
    jobId: "", // Will be set by caller
    queryEmbedding: jobEmbedding,
    topVectorMatches: filteredMatches.slice(0, topK),
    vectorFilterApplied: similarityThreshold > 0,
    similarityThreshold,
  };
}

/**
 * Combine pgvector results with skill-based re-ranking.
 * Useful for hybrid search: fast vector filtering + semantic reasoning.
 */
export function reRankBySimilarity<T extends { id: string; full_name: string; skills: string[] | null; similarity: number }>(
  pgvectorCandidates: T[],
  skillMatches: VectorMatch[]
): T[] {
  const skillMatchMap = new Map(skillMatches.map((m) => [m.candidateId, m]));

  // Re-order candidates based on skill match order, keeping all original properties
  const reordered: T[] = [];
  const seen = new Set<string>();

  // First add candidates in skill match order
  for (const skillMatch of skillMatches) {
    const candidate = pgvectorCandidates.find((c) => c.id === skillMatch.candidateId);
    if (candidate && !seen.has(candidate.id)) {
      reordered.push(candidate);
      seen.add(candidate.id);
    }
  }

  // Then add any remaining candidates that weren't in skill matches
  for (const candidate of pgvectorCandidates) {
    if (!seen.has(candidate.id)) {
      reordered.push(candidate);
      seen.add(candidate.id);
    }
  }

  return reordered;
}
