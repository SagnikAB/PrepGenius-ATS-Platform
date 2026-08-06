/**
 * ATS Formatting Checker
 * Validates resume PDFs for ATS compatibility
 * Flags layouts that may break during ATS parsing
 */

export interface ATSFormattingIssue {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  recommendation: string;
}

export interface ATSFormattingReport {
  isATSFriendly: boolean;
  compatibilityScore: number; // 0-100
  issues: ATSFormattingIssue[];
  warnings: number;
  errors: number;
  summary: string;
}

/**
 * Analyze resume text for ATS formatting issues
 */
export function checkATSFormatting(
  resumeText: string,
  pdfMetadata?: {
    pageCount?: number;
    hasImages?: boolean;
    hasComplexLayout?: boolean;
    hasEmbeddedFonts?: boolean;
  }
): ATSFormattingReport {
  const issues: ATSFormattingIssue[] = [];

  // Check for text-to-whitespace ratio (good ATS content should have balanced ratio)
  const textLength = resumeText.replace(/\s/g, "").length;
  const totalLength = resumeText.length;
  const contentRatio = textLength / totalLength;

  if (contentRatio < 0.3) {
    issues.push({
      severity: "warning",
      category: "Content Density",
      message: "Resume has excessive whitespace. May indicate complex formatting.",
      recommendation:
        "Simplify formatting and reduce gaps between sections for better ATS parsing.",
    });
  }

  // Check for multiple consecutive line breaks (indicates spacing/formatting)
  if (/\n\n\n+/.test(resumeText)) {
    issues.push({
      severity: "warning",
      category: "Layout",
      message: "Multiple line breaks detected. May indicate intentional spacing.",
      recommendation: "Use consistent single line breaks between sections.",
    });
  }

  // Check for special characters that might indicate tables or complex formatting
  if (/[┌┐└┘│─┼]+/.test(resumeText)) {
    issues.push({
      severity: "error",
      category: "Table Detection",
      message: "Resume appears to contain tables or box-drawing characters.",
      recommendation:
        "Convert tables to plain text or bullet-point lists. ATS systems struggle with tabular data.",
    });
  }

  // Check for multiple columns (common formatting that breaks ATS)
  const columnIndicators = /(left|right|column|\|\|)(?:\s+[A-Z]|\s+Jan|\s+\d{4})/i;
  if (columnIndicators.test(resumeText)) {
    issues.push({
      severity: "warning",
      category: "Multi-Column Layout",
      message: "Resume may use multiple columns.",
      recommendation:
        "Use single-column layout. Multi-column formats are not ATS-compatible.",
    });
  }

  // Check for common PDF artifacts that indicate images/graphics
  if (resumeText.toLowerCase().includes("[image]") || 
      resumeText.toLowerCase().includes("[graphic]") ||
      resumeText.toLowerCase().includes("[logo]")) {
    issues.push({
      severity: "warning",
      category: "Images/Graphics",
      message: "Resume contains images or graphics.",
      recommendation:
        "Replace graphics with text descriptions. ATS systems cannot parse images.",
    });
  }

  // Check for metadata indicating embedded images
  if (pdfMetadata?.hasImages) {
    issues.push({
      severity: "warning",
      category: "Images/Graphics",
      message: "PDF contains embedded images.",
      recommendation:
        "Consider re-uploading a text-based version without embedded images for better ATS compatibility.",
    });
  }

  // Check for unusual encoding or special formatting
  if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g.test(resumeText)) {
    issues.push({
      severity: "warning",
      category: "Text Encoding",
      message: "Resume contains non-standard characters or encoding.",
      recommendation:
        "Save resume as plain UTF-8 text to ensure proper encoding.",
    });
  }

  // Check for header/footer patterns (dates, page numbers, repeat info)
  const pageNumberPattern = /page\s+\d+\s+of\s+\d+|page\s+\d+/i;
  const headerFooterPattern = /^.{1,50}$/m; // Check for lines that look like headers/footers
  
  if (pageNumberPattern.test(resumeText)) {
    issues.push({
      severity: "info",
      category: "Page Formatting",
      message: "Resume contains page numbers.",
      recommendation: "Remove page numbers for cleaner ATS parsing.",
    });
  }

  // Check for repeating patterns (headers/footers appearing multiple times)
  const lines = resumeText.split("\n").map((l) => l.trim());
  const lineFrequency: Record<string, number> = {};
  lines.forEach((line) => {
    if (line.length > 10 && line.length < 60) {
      lineFrequency[line] = (lineFrequency[line] || 0) + 1;
    }
  });
  
  const repeatingLines = Object.entries(lineFrequency)
    .filter(([_, count]) => count > 2)
    .map(([line]) => line);
  
  if (repeatingLines.length > 0) {
    issues.push({
      severity: "info",
      category: "Repeating Content",
      message: `Detected ${repeatingLines.length} repeating text lines. May indicate headers/footers.`,
      recommendation:
        "Remove repeating headers and footers that might interfere with ATS parsing.",
    });
  }

  // Check for complex PDF metadata
  if (pdfMetadata?.hasComplexLayout) {
    issues.push({
      severity: "warning",
      category: "PDF Complexity",
      message: "PDF contains complex layout elements.",
      recommendation:
        "Simplify resume design. Use standard formatting without advanced layout features.",
    });
  }

  // Check line length consistency (very long lines might indicate wrapping issues)
  const avgLineLength =
    resumeText
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .reduce((sum, l) => sum + l.length, 0) /
    resumeText.split("\n").filter((l) => l.trim().length > 0).length;

  if (avgLineLength > 100) {
    issues.push({
      severity: "info",
      category: "Line Length",
      message: "Lines are quite long. May cause wrapping issues.",
      recommendation: "Keep lines under 100 characters for better readability.",
    });
  }

  // Calculate compatibility score
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  // Scoring: -15 per error, -5 per warning, -1 per info
  let score = 100 - errorCount * 15 - warningCount * 5 - infoCount * 1;
  score = Math.max(0, Math.min(100, score));

  // Determine if ATS friendly
  const isATSFriendly = errorCount === 0 && warningCount <= 2;

  // Generate summary
  let summary = "Resume formatting: ";
  if (isATSFriendly) {
    summary +=
      "Excellent ATS compatibility. No critical formatting issues detected.";
  } else if (errorCount > 0) {
    summary += `Has ${errorCount} critical formatting issues that will impact ATS parsing. Strongly recommend corrections.`;
  } else {
    summary += `Has ${warningCount} formatting warnings. Consider adjustments for optimal ATS compatibility.`;
  }

  return {
    isATSFriendly,
    compatibilityScore: score,
    issues,
    warnings: warningCount,
    errors: errorCount,
    summary,
  };
}

/**
 * Get ATS formatting tips based on detected issues
 */
export function getATSImprovementTips(report: ATSFormattingReport): string[] {
  const tips: string[] = [];

  if (report.errors === 0 && report.warnings === 0) {
    return [
      "Your resume has excellent ATS compatibility!",
      "Continue using simple, clean formatting for best results.",
    ];
  }

  report.issues.forEach((issue) => {
    if (issue.severity === "error" || issue.severity === "warning") {
      tips.push(issue.recommendation);
    }
  });

  // Add general tips if score is low
  if (report.compatibilityScore < 70) {
    tips.push(
      "Consider using a standard resume template designed for ATS compatibility."
    );
    tips.push("Avoid graphics, images, tables, and complex formatting.");
    tips.push("Use standard fonts (Arial, Helvetica, Times New Roman).");
    tips.push("Keep to a single column layout.");
  }

  return Array.from(new Set(tips)); // Remove duplicates
}
