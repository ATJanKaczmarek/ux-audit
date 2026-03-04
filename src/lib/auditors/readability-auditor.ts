import type { AuditResult, Finding, PageData } from "@/types/scan";
import { v4 as uuidv4 } from "uuid";

interface ReadabilityMetrics {
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  avgSentenceLength: number;
  avgWordLength: number;
  wordCount: number;
}

function computeReadability(text: string): ReadabilityMetrics | null {
  const words = text.match(/\b\w+\b/g) ?? [];
  if (words.length < 50) return null;

  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  if (sentences.length === 0) return null;

  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const avgSentenceLen = words.length / sentences.length;
  const avgSyllables = syllableCount / words.length;
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / words.length;

  // Flesch Reading Ease: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
  const fre = Math.max(0, Math.min(100, 206.835 - 1.015 * avgSentenceLen - 84.6 * avgSyllables));

  // Flesch-Kincaid Grade Level: 0.39*(words/sentences) + 11.8*(syllables/words) - 15.59
  const fkgl = Math.max(0, 0.39 * avgSentenceLen + 11.8 * avgSyllables - 15.59);

  return {
    fleschKincaidGrade: Math.round(fkgl * 10) / 10,
    fleschReadingEase: Math.round(fre * 10) / 10,
    avgSentenceLength: Math.round(avgSentenceLen * 10) / 10,
    avgWordLength: Math.round(avgWordLen * 10) / 10,
    wordCount: words.length,
  };
}

function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

export function runReadabilityAudit(pages: PageData[]): AuditResult {
  const findings: Finding[] = [];
  let totalChecks = 0;
  let passedChecks = 0;
  const pageMetrics: ReadabilityMetrics[] = [];

  for (const page of pages) {
    if (!page.mainTextContent || page.wordCount < 50) continue;

    const metrics = computeReadability(page.mainTextContent);
    if (!metrics) continue;

    pageMetrics.push(metrics);

    // Check 1: Flesch-Kincaid Grade Level
    totalChecks++;
    if (metrics.fleschKincaidGrade > 12) {
      findings.push({
        id: uuidv4(),
        category: "content_quality",
        severity: metrics.fleschKincaidGrade > 16 ? "high" : "medium",
        title: "High Reading Grade Level",
        description: `Content has a Flesch-Kincaid grade of ${metrics.fleschKincaidGrade} — recommended: ≤12 for general audiences.`,
        affectedPages: [page.url],
        evidence: `FK Grade: ${metrics.fleschKincaidGrade}, FRE: ${metrics.fleschReadingEase}`,
        remediation:
          "Simplify sentence structure, replace jargon with plain language, aim for sentences of 15-20 words.",
        heuristicRef: "Nielsen #2: Match between system and the real world",
      });
    } else {
      passedChecks++;
    }

    // Check 2: Average sentence length
    totalChecks++;
    if (metrics.avgSentenceLength > 25) {
      findings.push({
        id: uuidv4(),
        category: "content_quality",
        severity: "medium",
        title: "Long Average Sentence Length",
        description: `Average sentence is ${metrics.avgSentenceLength} words — recommended: 15-20 words.`,
        affectedPages: [page.url],
        evidence: `Avg sentence length: ${metrics.avgSentenceLength} words`,
        remediation:
          "Break long sentences into shorter ones. Use bullet points for list-style content.",
      });
    } else {
      passedChecks++;
    }

    // Check 3: Word count (thin content)
    totalChecks++;
    if (page.wordCount < 200) {
      findings.push({
        id: uuidv4(),
        category: "content_quality",
        severity: "low",
        title: "Thin Content",
        description: `Page has only ${page.wordCount} words — thin content may not adequately inform users.`,
        affectedPages: [page.url],
        evidence: `Word count: ${page.wordCount}`,
        remediation:
          "Expand content with helpful details, FAQs, or supporting information relevant to users' goals.",
      });
    } else if (page.wordCount > 50) {
      passedChecks++;
    }
  }

  // Aggregate score
  let score = 100;
  if (pageMetrics.length > 0) {
    const avgGrade = pageMetrics.reduce((s, m) => s + m.fleschKincaidGrade, 0) / pageMetrics.length;
    const avgFRE = pageMetrics.reduce((s, m) => s + m.fleschReadingEase, 0) / pageMetrics.length;

    if (avgGrade <= 8) score = 100;
    else if (avgGrade <= 10) score = 85;
    else if (avgGrade <= 12) score = 70;
    else if (avgGrade <= 14) score = 55;
    else score = 40;

    // Boost for good FRE
    if (avgFRE >= 60) score = Math.min(100, score + 10);
  }

  return {
    category: "content_quality",
    score,
    findings: deduplicateFindings(findings),
    passedChecks,
    totalChecks,
    rawData: {
      analyzedPages: pageMetrics.length,
      avgGrade:
        pageMetrics.length > 0
          ? pageMetrics.reduce((s, m) => s + m.fleschKincaidGrade, 0) / pageMetrics.length
          : null,
    },
  };
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of findings) {
    if (seen.has(f.title)) {
      seen.get(f.title)!.affectedPages = [
        ...new Set([...seen.get(f.title)!.affectedPages, ...f.affectedPages]),
      ];
    } else {
      seen.set(f.title, { ...f });
    }
  }
  return Array.from(seen.values());
}
