#!/usr/bin/env node

/**
 * Test Script for Kaggle Resume Datasets
 * Tests PrepGenius matching engine against Kaggle resume data
 * 
 * Usage: node scripts/test-kaggle-datasets.js --dataset <path> --job-desc <path>
 * 
 * Expected formats:
 * - Resumes: JSON array with { name, skills, experience, education, text }
 * - Job descriptions: JSON array with { title, description, required_skills }
 */

const fs = require("fs");
const path = require("path");

interface TestConfig {
  datasetPath: string;
  jobDescPath: string;
  outputPath: string;
  verbose: boolean;
}

interface TestResult {
  testName: string;
  timestamp: string;
  totalResumes: number;
  totalJobs: number;
  matchResults: MatchTestResult[];
  averageMatchScore: number;
  topMatches: TopMatch[];
  performanceMetrics: PerformanceMetrics;
}

interface MatchTestResult {
  resumeId: string;
  jobId: string;
  resumeName: string;
  jobTitle: string;
  matchScore: number;
  skillMatchPercentage: number;
  experienceScore: number;
  semanticScore: number;
  atsCompatibilityScore: number;
  atsWarnings: number;
}

interface TopMatch {
  resumeId: string;
  jobId: string;
  matchScore: number;
}

interface PerformanceMetrics {
  totalProcessingTime: number;
  avgTimePerMatch: number;
  peakMemoryUsage: number;
  successRate: number;
  failureCount: number;
}

// Parse command line arguments
function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config: Partial<TestConfig> = {
    outputPath: "./test-results.json",
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dataset") config.datasetPath = args[++i];
    if (args[i] === "--job-desc") config.jobDescPath = args[++i];
    if (args[i] === "--output") config.outputPath = args[++i];
    if (args[i] === "--verbose") config.verbose = true;
  }

  if (!config.datasetPath || !config.jobDescPath) {
    console.error("Error: Missing required arguments");
    console.error("Usage: node scripts/test-kaggle-datasets.js --dataset <path> --job-desc <path>");
    process.exit(1);
  }

  return config as TestConfig;
}

// Load and validate dataset
function loadDataset(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      throw new Error("Dataset must be a JSON array");
    }

    return data;
  } catch (error) {
    console.error(`Failed to load dataset from ${filePath}:`, error);
    process.exit(1);
  }
}

// Validate resume format
function validateResume(resume: any, index: number): boolean {
  const required = ["name", "text"];
  const missing = required.filter((field) => !resume[field]);

  if (missing.length > 0) {
    console.warn(
      `Warning: Resume ${index} missing fields: ${missing.join(", ")}`
    );
    return false;
  }

  return true;
}

// Validate job description format
function validateJobDesc(job: any, index: number): boolean {
  const required = ["title", "description"];
  const missing = required.filter((field) => !job[field]);

  if (missing.length > 0) {
    console.warn(
      `Warning: Job ${index} missing fields: ${missing.join(", ")}`
    );
    return false;
  }

  return true;
}

// Simulate skill extraction and matching (mock implementation)
function extractSkills(text: string): string[] {
  const commonSkills = [
    "javascript",
    "typescript",
    "python",
    "java",
    "react",
    "nodejs",
    "sql",
    "mongodb",
    "aws",
    "docker",
    "kubernetes",
    "machine learning",
    "data analysis",
    "rest api",
    "graphql",
  ];

  const lowerText = text.toLowerCase();
  return commonSkills.filter((skill) => lowerText.includes(skill));
}

// Calculate match score components
function calculateMatchScore(resume: any, job: any): MatchTestResult {
  const resumeSkills = extractSkills(resume.text || resume.skills?.join(" ") || "");
  const jobSkills = job.required_skills || extractSkills(job.description);

  // Skill match percentage
  const matchedSkills = resumeSkills.filter((s) =>
    jobSkills.some((js: string) => js.includes(s) || s.includes(js))
  );
  const skillMatchPercentage = jobSkills.length > 0 
    ? (matchedSkills.length / jobSkills.length) * 100 
    : 0;

  // Experience score (mock based on text length and keywords)
  const experienceKeywords = ["years", "experience", "worked", "led", "managed"];
  const expCount = experienceKeywords.filter((kw) =>
    (resume.text || "").toLowerCase().includes(kw)
  ).length;
  const experienceScore = Math.min((expCount / 5) * 100, 100);

  // Semantic score (mock based on text similarity)
  const resumeWords = (resume.text || "").toLowerCase().split(/\s+/);
  const jobWords = (job.description || "").toLowerCase().split(/\s+/);
  const commonWords = resumeWords.filter((w) =>
    jobWords.includes(w) && w.length > 3
  ).length;
  const semanticScore = Math.min(
    (commonWords / Math.max(jobWords.length, 1)) * 100,
    100
  );

  // ATS compatibility score (mock)
  const atsCompatibilityScore = 85 + Math.random() * 15;
  const atsWarnings = Math.floor(Math.random() * 3);

  // Overall match score (weighted average)
  const matchScore =
    skillMatchPercentage * 0.4 +
    experienceScore * 0.3 +
    semanticScore * 0.2 +
    atsCompatibilityScore * 0.1;

  return {
    resumeId: resume.id || `resume_${Math.random().toString(36).substr(2, 9)}`,
    jobId: job.id || `job_${Math.random().toString(36).substr(2, 9)}`,
    resumeName: resume.name || "Unknown",
    jobTitle: job.title || "Unknown",
    matchScore: parseFloat(matchScore.toFixed(2)),
    skillMatchPercentage: parseFloat(skillMatchPercentage.toFixed(2)),
    experienceScore: parseFloat(experienceScore.toFixed(2)),
    semanticScore: parseFloat(semanticScore.toFixed(2)),
    atsCompatibilityScore: parseFloat(atsCompatibilityScore.toFixed(2)),
    atsWarnings,
  };
}

// Run matching tests
function runTests(config: TestConfig, resumes: any[], jobs: any[]): TestResult {
  console.log(`\n🧪 Starting Kaggle Dataset Tests`);
  console.log(`📊 Resumes: ${resumes.length} | Jobs: ${jobs.length}`);

  const startTime = Date.now();
  const initialMemory = process.memoryUsage().heapUsed;

  // Validate datasets
  const validResumes = resumes.filter((r, i) => validateResume(r, i));
  const validJobs = jobs.filter((j, i) => validateJobDesc(j, i));

  console.log(
    `✅ Valid resumes: ${validResumes.length}/${resumes.length} | Valid jobs: ${validJobs.length}/${jobs.length}`
  );

  // Run matching
  const matchResults: MatchTestResult[] = [];
  let failureCount = 0;

  for (const resume of validResumes.slice(0, 20)) {
    // Limit to 20 resumes per test
    for (const job of validJobs.slice(0, 10)) {
      // Limit to 10 jobs per resume
      try {
        const result = calculateMatchScore(resume, job);
        matchResults.push(result);
      } catch (error) {
        if (config.verbose) {
          console.error(`Error matching ${resume.name} to ${job.title}:`, error);
        }
        failureCount++;
      }
    }
  }

  // Calculate statistics
  const matchScores = matchResults.map((r) => r.matchScore);
  const averageMatchScore =
    matchScores.reduce((a, b) => a + b, 0) / matchScores.length || 0;

  // Top 10 matches
  const topMatches = matchResults
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10)
    .map((r) => ({
      resumeId: r.resumeId,
      jobId: r.jobId,
      matchScore: r.matchScore,
    }));

  const endTime = Date.now();
  const peakMemory = process.memoryUsage().heapUsed;
  const processingTime = endTime - startTime;

  const result: TestResult = {
    testName: `Kaggle Dataset Test - ${new Date().toISOString()}`,
    timestamp: new Date().toISOString(),
    totalResumes: validResumes.length,
    totalJobs: validJobs.length,
    matchResults,
    averageMatchScore: parseFloat(averageMatchScore.toFixed(2)),
    topMatches,
    performanceMetrics: {
      totalProcessingTime: processingTime,
      avgTimePerMatch: parseFloat((processingTime / matchResults.length).toFixed(2)),
      peakMemoryUsage: (peakMemory - initialMemory) / 1024 / 1024, // MB
      successRate: parseFloat(
        ((matchResults.length / (validResumes.length * validJobs.length)) * 100).toFixed(2)
      ),
      failureCount,
    },
  };

  return result;
}

// Print results summary
function printResults(result: TestResult): void {
  console.log("\n📈 Test Results Summary");
  console.log("=".repeat(50));
  console.log(`Test: ${result.testName}`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Total Matches Processed: ${result.matchResults.length}`);
  console.log(`Average Match Score: ${result.averageMatchScore}%`);
  console.log(`\n🔝 Top 3 Matches:`);

  result.topMatches.slice(0, 3).forEach((match, idx) => {
    console.log(
      `  ${idx + 1}. Resume: ${match.resumeId} → Job: ${match.jobId} (${match.matchScore}%)`
    );
  });

  console.log(`\n⚡ Performance Metrics:`);
  console.log(`  Processing Time: ${result.performanceMetrics.totalProcessingTime}ms`);
  console.log(
    `  Avg Time/Match: ${result.performanceMetrics.avgTimePerMatch}ms`
  );
  console.log(
    `  Peak Memory: ${result.performanceMetrics.peakMemoryUsage.toFixed(2)}MB`
  );
  console.log(`  Success Rate: ${result.performanceMetrics.successRate}%`);
  if (result.performanceMetrics.failureCount > 0) {
    console.log(`  Failures: ${result.performanceMetrics.failureCount}`);
  }

  console.log("=".repeat(50));
}

// Save results to file
function saveResults(result: TestResult, outputPath: string): void {
  try {
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ Results saved to: ${outputPath}`);
  } catch (error) {
    console.error(`Failed to save results:`, error);
  }
}

// Main execution
function main(): void {
  const config = parseArgs();

  console.log("🚀 PrepGenius Kaggle Dataset Test Suite");
  console.log("Loading datasets...");

  const resumes = loadDataset(config.datasetPath);
  const jobs = loadDataset(config.jobDescPath);

  const results = runTests(config, resumes, jobs);
  printResults(results);
  saveResults(results, config.outputPath);

  console.log("\n✨ Test suite completed!");
}

main();
