/**
 * Scoring Utility for Resume Matching Evaluation
 * Implements Precision, Recall, F1-Score, and other ML metrics
 * for evaluating candidate-job matching performance
 */

export interface ClassificationMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  specificity: number;
  sensitivity: number;
}

export interface ConfusionMatrix {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  total: number;
}

export interface ScoreDistribution {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q25: number;
  q75: number;
}

export interface MatchingEvaluationReport {
  totalMatches: number;
  totalRelevantMatches: number;
  metrics: ClassificationMetrics;
  confusionMatrix: ConfusionMatrix;
  scoreDistribution: ScoreDistribution;
  matchQualityBuckets: {
    excellent: number; // 90-100
    good: number; // 75-89
    average: number; // 60-74
    poor: number; // 40-59
    veryPoor: number; // 0-39
  };
  recommendations: string[];
}

/**
 * Calculate confusion matrix from predictions and actual labels
 * @param predictions Array of match scores (0-100)
 * @param actuals Array of actual relevance (0 = not relevant, 1 = relevant)
 * @param threshold Score threshold for positive prediction (default: 60)
 */
export function calculateConfusionMatrix(
  predictions: number[],
  actuals: number[],
  threshold: number = 60
): ConfusionMatrix {
  if (predictions.length !== actuals.length) {
    throw new Error("Predictions and actuals must have the same length");
  }

  let tp = 0, fp = 0, tn = 0, fn = 0;

  for (let i = 0; i < predictions.length; i++) {
    const predicted = predictions[i] >= threshold ? 1 : 0;
    const actual = actuals[i];

    if (predicted === 1 && actual === 1) tp++;
    else if (predicted === 1 && actual === 0) fp++;
    else if (predicted === 0 && actual === 0) tn++;
    else if (predicted === 0 && actual === 1) fn++;
  }

  return {
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    total: predictions.length,
  };
}

/**
 * Calculate Precision: TP / (TP + FP)
 * What proportion of positive predictions were correct?
 */
export function calculatePrecision(cm: ConfusionMatrix): number {
  const denominator = cm.truePositives + cm.falsePositives;
  return denominator === 0 ? 0 : cm.truePositives / denominator;
}

/**
 * Calculate Recall: TP / (TP + FN)
 * What proportion of actual positives were correctly identified?
 */
export function calculateRecall(cm: ConfusionMatrix): number {
  const denominator = cm.truePositives + cm.falseNegatives;
  return denominator === 0 ? 0 : cm.truePositives / denominator;
}

/**
 * Calculate F1-Score: 2 * (Precision * Recall) / (Precision + Recall)
 * Harmonic mean of precision and recall
 */
export function calculateF1Score(precision: number, recall: number): number {
  const denominator = precision + recall;
  return denominator === 0 ? 0 : 2 * (precision * recall) / denominator;
}

/**
 * Calculate Accuracy: (TP + TN) / Total
 * Overall correctness of predictions
 */
export function calculateAccuracy(cm: ConfusionMatrix): number {
  return (cm.truePositives + cm.trueNegatives) / cm.total;
}

/**
 * Calculate Specificity: TN / (TN + FP)
 * True negative rate - ability to identify negative cases
 */
export function calculateSpecificity(cm: ConfusionMatrix): number {
  const denominator = cm.trueNegatives + cm.falsePositives;
  return denominator === 0 ? 0 : cm.trueNegatives / denominator;
}

/**
 * Calculate Sensitivity: TP / (TP + FN)
 * Same as Recall - true positive rate
 */
export function calculateSensitivity(cm: ConfusionMatrix): number {
  return calculateRecall(cm);
}

/**
 * Calculate all classification metrics at once
 */
export function calculateClassificationMetrics(
  cm: ConfusionMatrix
): ClassificationMetrics {
  const precision = calculatePrecision(cm);
  const recall = calculateRecall(cm);

  return {
    precision,
    recall,
    f1Score: calculateF1Score(precision, recall),
    accuracy: calculateAccuracy(cm),
    specificity: calculateSpecificity(cm),
    sensitivity: calculateSensitivity(cm),
  };
}

/**
 * Calculate score distribution statistics
 */
export function calculateScoreDistribution(scores: number[]): ScoreDistribution {
  if (scores.length === 0) {
    return { mean: 0, median: 0, std: 0, min: 0, max: 0, q25: 0, q75: 0 };
  }

  // Sort scores for quantile calculation
  const sorted = [...scores].sort((a, b) => a - b);

  // Mean
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Median
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  // Standard deviation
  const variance =
    scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
    scores.length;
  const std = Math.sqrt(variance);

  // Min/Max
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Quartiles
  const q25Index = Math.ceil(sorted.length * 0.25) - 1;
  const q75Index = Math.ceil(sorted.length * 0.75) - 1;
  const q25 = sorted[Math.max(0, q25Index)];
  const q75 = sorted[Math.min(sorted.length - 1, q75Index)];

  return {
    mean: parseFloat(mean.toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    std: parseFloat(std.toFixed(2)),
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    q25: parseFloat(q25.toFixed(2)),
    q75: parseFloat(q75.toFixed(2)),
  };
}

/**
 * Categorize match scores into quality buckets
 */
export function categorizeMatchQuality(scores: number[]): Record<string, number> {
  return {
    excellent: scores.filter((s) => s >= 90).length,
    good: scores.filter((s) => s >= 75 && s < 90).length,
    average: scores.filter((s) => s >= 60 && s < 75).length,
    poor: scores.filter((s) => s >= 40 && s < 60).length,
    veryPoor: scores.filter((s) => s < 40).length,
  };
}

/**
 * Generate recommendations based on evaluation results
 */
export function generateRecommendations(
  metrics: ClassificationMetrics,
  distribution: ScoreDistribution,
  qualityBuckets: any
): string[] {
  const recommendations: string[] = [];

  // Precision recommendations
  if (metrics.precision < 0.6) {
    recommendations.push(
      "Low precision: Many false positives. Consider increasing match score threshold or improving skill matching logic."
    );
  } else if (metrics.precision > 0.95) {
    recommendations.push(
      "Very high precision: May be too conservative. Consider lowering threshold to capture more matches."
    );
  }

  // Recall recommendations
  if (metrics.recall < 0.6) {
    recommendations.push(
      "Low recall: Missing relevant candidates. Improve semantic matching or broaden skill matching criteria."
    );
  } else if (metrics.recall > 0.95) {
    recommendations.push(
      "Excellent recall: Successfully identifying most relevant candidates."
    );
  }

  // F1-Score recommendations
  if (metrics.f1Score < 0.65) {
    recommendations.push(
      "Low F1-Score: Balance between precision and recall needs improvement. Review matching algorithm."
    );
  }

  // Score distribution recommendations
  if (distribution.mean < 50) {
    recommendations.push(
      "Low average match score: Consider improving resume parsing or skill extraction."
    );
  }

  if (distribution.std > 30) {
    recommendations.push(
      "High score variance: Match quality is inconsistent. Ensure uniform feature scaling."
    );
  }

  // Quality bucket recommendations
  const totalQualityMatches = Object.values(qualityBuckets).reduce(
    (a: number, b: unknown) => a + (b as number),
    0
  );
  const excellentPercent =
    (qualityBuckets.excellent / totalQualityMatches) * 100;

  if (excellentPercent < 5) {
    recommendations.push(
      "Few excellent matches: Refine semantic matching to improve top-tier match quality."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Matching performance is within acceptable parameters. Continue monitoring metrics."
    );
  }

  return recommendations;
}

/**
 * Generate comprehensive evaluation report
 */
export function generateEvaluationReport(
  matchScores: number[],
  actualRelevance: number[],
  threshold: number = 60
): MatchingEvaluationReport {
  const cm = calculateConfusionMatrix(matchScores, actualRelevance, threshold);
  const metrics = calculateClassificationMetrics(cm);
  const distribution = calculateScoreDistribution(matchScores);
  const qualityBuckets = categorizeMatchQuality(matchScores);

  const recommendations = generateRecommendations(
    metrics,
    distribution,
    qualityBuckets
  );

  return {
    totalMatches: matchScores.length,
    totalRelevantMatches: actualRelevance.reduce((a, b) => a + b, 0),
    metrics,
    confusionMatrix: cm,
    scoreDistribution: distribution,
    matchQualityBuckets: qualityBuckets as any,
    recommendations,
  };
}

/**
 * Calculate Mean Average Precision (MAP) for ranking evaluation
 */
export function calculateMeanAveragePrecision(
  rankedScores: number[][],
  relevance: number[][]
): number {
  let totalAP = 0;

  for (let i = 0; i < rankedScores.length; i++) {
    const scores = rankedScores[i];
    const relevances = relevance[i];

    let precisionSum = 0;
    let relevantCount = 0;

    for (let j = 0; j < scores.length; j++) {
      if (relevances[j] === 1) {
        relevantCount++;
        precisionSum += relevantCount / (j + 1);
      }
    }

    const totalRelevant = relevances.reduce((a, b) => a + b, 0);
    const ap = totalRelevant > 0 ? precisionSum / totalRelevant : 0;
    totalAP += ap;
  }

  return totalAP / rankedScores.length;
}

/**
 * Calculate Normalized Discounted Cumulative Gain (NDCG) for ranking quality
 */
export function calculateNDCG(rankedScores: number[], maxScore: number = 100): number {
  let dcg = 0;
  let idcg = 0;

  const sorted = [...rankedScores].sort((a, b) => b - a);

  for (let i = 0; i < rankedScores.length; i++) {
    const relevance = (rankedScores[i] / maxScore) * 5; // Normalize to 0-5 scale
    const ideal = (sorted[i] / maxScore) * 5;

    dcg += relevance / Math.log2(i + 2); // +2 because log2(1) = 0
    idcg += ideal / Math.log2(i + 2);
  }

  return idcg > 0 ? dcg / idcg : 0;
}
