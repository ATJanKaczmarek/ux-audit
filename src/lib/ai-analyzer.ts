import Anthropic from "@anthropic-ai/sdk";
import type { ScanResult, AIInsights, FlowType } from "@/types/scan";

const client = new Anthropic();

function buildPrompt(scan: Omit<ScanResult, "aiInsights" | "completedAt">): string {
  const { url, overallScore, categoryScores, findings, detectedFlows, totalPagesAnalyzed } = scan;

  const topFindings = findings
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .slice(0, 15)
    .map((f) => `- [${f.severity.toUpperCase()}] ${f.category}: ${f.title} — ${f.description}`)
    .join("\n");

  const categoryBreakdown = categoryScores
    .map((cs) => `  ${cs.category}: ${cs.score}/100 (${cs.findings.length} findings)`)
    .join("\n");

  const flowsSummary = detectedFlows
    .map(
      (f) =>
        `  ${f.type}: ${f.pages.length} pages, completeness ${Math.round(f.completeness * 100)}%${f.issues.length > 0 ? `, issues: ${f.issues.join("; ")}` : ""}`,
    )
    .join("\n");

  const mediumFindings = findings
    .filter((f) => f.severity === "medium")
    .slice(0, 10)
    .map((f) => `- ${f.category}: ${f.title}`)
    .join("\n");

  return `You are a senior UX consultant reviewing automated audit results for ${url}.

SCAN OVERVIEW:
- Overall UX Score: ${overallScore}/100
- Pages analyzed: ${totalPagesAnalyzed}
- Total findings: ${findings.length} (${findings.filter((f) => f.severity === "critical").length} critical, ${findings.filter((f) => f.severity === "high").length} high, ${findings.filter((f) => f.severity === "medium").length} medium)

CATEGORY SCORES:
${categoryBreakdown}

CRITICAL & HIGH SEVERITY FINDINGS:
${topFindings || "None"}

MEDIUM SEVERITY FINDINGS:
${mediumFindings || "None"}

DETECTED USER FLOWS:
${flowsSummary || "No flows detected"}

Please provide a structured UX analysis with exactly these four sections, using the exact headers shown:

## EXECUTIVE SUMMARY
Write 2-3 paragraphs (~150 words total) covering: overall UX health assessment, the most impactful issue categories, and the relationship between the score and real user impact.

## TOP 5 PRIORITIES
List exactly 5 actionable recommendations in order of impact. For each, use this format:
1. **[Title]** — [Impact: High/Medium/Low] — [One sentence rationale explaining business/user impact]

## USER FLOW COMMENTARY
For each detected flow (or note if none detected), provide a 1-2 sentence UX assessment covering flow completeness and key friction points.

## QUICK WINS
List 3-5 easy fixes that can be implemented quickly with minimal engineering effort but measurable UX improvement. Format as a bulleted list.`;
}

function parseSections(text: string): AIInsights {
  // Extract Executive Summary
  const summaryMatch = text.match(/##\s*EXECUTIVE SUMMARY\s*\n([\s\S]*?)(?=##|$)/i);
  const executiveSummary = summaryMatch ? summaryMatch[1].trim() : text.slice(0, 500);

  // Extract Top 5 Priorities
  const prioritiesMatch = text.match(/##\s*TOP 5 PRIORITIES\s*\n([\s\S]*?)(?=##|$)/i);
  const prioritiesText = prioritiesMatch ? prioritiesMatch[1].trim() : "";
  const topPriorities = parsePriorities(prioritiesText);

  // Extract Flow Commentary
  const flowMatch = text.match(/##\s*USER FLOW COMMENTARY\s*\n([\s\S]*?)(?=##|$)/i);
  const flowText = flowMatch ? flowMatch[1].trim() : "";
  const flowCommentary = parseFlowCommentary(flowText);

  // Extract Quick Wins
  const quickWinsMatch = text.match(/##\s*QUICK WINS\s*\n([\s\S]*?)(?=##|$)/i);
  const quickWinsText = quickWinsMatch ? quickWinsMatch[1].trim() : "";
  const quickWins = quickWinsText
    .split("\n")
    .filter((line) => line.match(/^[-*•]\s/))
    .map((line) => line.replace(/^[-*•]\s/, "").trim())
    .filter(Boolean);

  return {
    executiveSummary,
    topPriorities,
    flowCommentary,
    quickWins,
  };
}

function parsePriorities(text: string): AIInsights["topPriorities"] {
  const priorities: AIInsights["topPriorities"] = [];
  const lines = text.split("\n").filter((l) => l.match(/^\d+\.\s/));

  for (const line of lines.slice(0, 5)) {
    const impactMatch = line.match(/Impact:\s*(High|Medium|Low)/i);
    const impact = (impactMatch ? impactMatch[1].toLowerCase() : "medium") as
      | "high"
      | "medium"
      | "low";

    // Extract title (between ** if present)
    const titleMatch = line.match(/\*\*([^*]+)\*\*/);
    const title = titleMatch ? titleMatch[1] : line.replace(/^\d+\.\s/, "").split("—")[0].trim();

    // Extract rationale
    const parts = line.split("—");
    const rationale = parts[parts.length - 1]?.trim() ?? line;

    priorities.push({ title, rationale, impact });
  }

  return priorities;
}

function parseFlowCommentary(text: string): AIInsights["flowCommentary"] {
  const commentary: AIInsights["flowCommentary"] = [];
  const flowTypePattern = /\b(signup|login|checkout|onboarding|search|contact|product)\b/gi;

  const paragraphs = text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => l.trim());

  for (const para of paragraphs) {
    const match = para.match(flowTypePattern);
    if (match) {
      commentary.push({
        flowType: match[0].toLowerCase() as FlowType,
        assessment: para.replace(/^\*\*[^*]+\*\*:?\s*/, "").trim(),
      });
    }
  }

  if (commentary.length === 0 && text.trim().length > 0) {
    commentary.push({ flowType: "unknown", assessment: text.slice(0, 300) });
  }

  return commentary;
}

export async function generateAIInsights(
  scan: Omit<ScanResult, "aiInsights" | "completedAt">,
  onChunk: (chunk: string) => void,
): Promise<AIInsights> {
  const prompt = buildPrompt(scan);
  let fullText = "";

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        fullText += chunk.delta.text;
        onChunk(chunk.delta.text);
      }
    }
  } catch (err) {
    console.error("[ai-analyzer] Error calling Claude API:", err);
    // Return a minimal fallback
    return {
      executiveSummary: `Analysis complete for ${scan.url}. Overall score: ${scan.overallScore}/100. ${scan.findings.length} findings identified across ${scan.categoryScores.length} categories.`,
      topPriorities: scan.findings
        .filter((f) => f.severity === "critical" || f.severity === "high")
        .slice(0, 5)
        .map((f) => ({
          title: f.title,
          rationale: f.description,
          impact: (f.severity === "critical" ? "high" : "medium") as "high" | "medium" | "low",
        })),
      flowCommentary: [],
      quickWins: [],
    };
  }

  return parseSections(fullText);
}
