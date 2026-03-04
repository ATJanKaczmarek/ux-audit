// ── Core scan types ───────────────────────────────────────────────────────────

export type ScanStatus = "pending" | "running" | "complete" | "error";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type AuditCategory =
  | "accessibility"
  | "performance"
  | "visual_hierarchy"
  | "navigation"
  | "forms"
  | "content_quality"
  | "mobile"
  | "cta";

export type FlowType =
  | "signup"
  | "login"
  | "checkout"
  | "onboarding"
  | "search"
  | "contact"
  | "product"
  | "unknown";

// ── Page-level raw data gathered by Playwright ────────────────────────────────

export interface HeadingData {
  level: number; // 1-6
  text: string;
  visible: boolean;
}

export interface FontData {
  selector: string;
  fontSize: number; // px
  fontWeight: number;
  lineHeight: number;
  color: string;
  backgroundColor: string;
}

export interface FormData {
  id: string;
  action: string;
  method: string;
  fields: FormFieldData[];
  hasSubmitButton: boolean;
  submitButtonText: string;
  hasMultiStep: boolean;
}

export interface FormFieldData {
  type: string;
  name: string;
  label: string;
  hasLabel: boolean;
  hasPlaceholderAsLabel: boolean;
  hasAutocomplete: boolean;
  isRequired: boolean;
}

export interface LinkData {
  href: string;
  text: string;
  isInternal: boolean;
  isNavigation: boolean;
  statusCode?: number;
}

export interface CTAData {
  text: string;
  tag: string; // button | a
  position: "above-fold" | "below-fold";
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor: string;
  textColor: string;
  contrastRatio: number;
  isActionVerb: boolean;
}

export interface PageData {
  url: string;
  title: string;
  statusCode: number;
  depth: number; // crawl depth from root
  headings: HeadingData[];
  fonts: FontData[];
  forms: FormData[];
  links: LinkData[];
  ctas: CTAData[];
  hasViewportMeta: boolean;
  viewportContent: string;
  hasBreadcrumbs: boolean;
  mainTextContent: string;
  wordCount: number;
  imageCount: number;
  viewportWidth: number;
  viewportHeight: number;
  hasHorizontalOverflow: boolean;
  touchTargetViolations: number;
  loadedAt: number;
  screenshotPath?: string; // relative: "screenshots/{scanId}/{md5}.jpg"
}

// ── Audit results ─────────────────────────────────────────────────────────────

export interface Finding {
  id: string;
  category: AuditCategory;
  severity: Severity;
  title: string;
  description: string;
  affectedPages: string[]; // URLs
  evidence: string;
  remediation: string;
  heuristicRef?: string; // e.g. "Nielsen #4: Consistency and Standards"
  wcagRef?: string; // e.g. "WCAG 1.4.3"
}

export interface CategoryScore {
  category: AuditCategory;
  score: number; // 0-100
  weight: number; // 0-1, sum of all weights = 1
  findings: Finding[];
  passedChecks: number;
  totalChecks: number;
}

export interface LighthouseMetrics {
  url: string;
  fcp: number; // ms
  lcp: number; // ms
  cls: number; // score
  tbt: number; // ms
  si: number; // ms (Speed Index)
  performanceScore: number; // 0-100
  accessibilityScore: number;
}

export interface AxeViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  description: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
  affectedPages: string[];
}

export interface AuditResult {
  category: AuditCategory;
  score: number;
  findings: Finding[];
  passedChecks: number;
  totalChecks: number;
  rawData?: Record<string, unknown>;
}

// ── Flow detection ────────────────────────────────────────────────────────────

export interface FlowNode {
  url: string;
  title: string;
  flowType: FlowType;
  depth: number;
  hasForms: boolean;
  hasPaymentFields: boolean;
}

export interface FlowEdge {
  from: string; // URL
  to: string; // URL
  linkText: string;
}

export interface DetectedFlow {
  type: FlowType;
  pages: FlowNode[];
  edges: FlowEdge[];
  completeness: number; // 0-1, how complete the flow seems
  issues: string[];
}

// ── AI analysis ───────────────────────────────────────────────────────────────

export interface AIInsights {
  executiveSummary: string;
  topPriorities: Array<{
    title: string;
    rationale: string;
    impact: "high" | "medium" | "low";
  }>;
  flowCommentary: Array<{
    flowType: FlowType;
    assessment: string;
  }>;
  quickWins: string[];
}

// ── Final scan result ─────────────────────────────────────────────────────────

export interface ScanResult {
  scanId: string;
  url: string;
  status: ScanStatus;
  createdAt: number;
  completedAt?: number;
  pages: PageData[];
  categoryScores: CategoryScore[];
  overallScore: number;
  findings: Finding[];
  lighthouseMetrics: LighthouseMetrics[];
  axeViolations: AxeViolation[];
  detectedFlows: DetectedFlow[];
  urlGraph: Record<string, string[]>; // adjacency list
  aiInsights?: AIInsights;
  errorMessage?: string;
  totalPagesAnalyzed: number;
  crawlDuration: number; // ms
}

export interface ScanRow {
  id: string;
  url: string;
  status: ScanStatus;
  created_at: number;
  completed_at: number | null;
  result_json: string | null;
}

// ── SSE event types ───────────────────────────────────────────────────────────

export type ScanEvent =
  | { event: "crawl_start"; total: number }
  | { event: "crawl_progress"; current: number; total: number; url: string }
  | { event: "page_analyzed"; index: number; total: number; url: string }
  | { event: "screenshot_captured"; index: number; total: number; url: string }
  | { event: "lighthouse_progress"; index: number; total: number }
  | { event: "audit_complete"; category: string }
  | { event: "ai_progress"; chunk: string }
  | { event: "complete"; scanId: string }
  | { event: "error"; message: string };
