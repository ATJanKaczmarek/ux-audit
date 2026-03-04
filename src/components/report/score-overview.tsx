"use client";

import type { CategoryScore } from "@/types/scan";

const CATEGORY_LABELS: Record<string, string> = {
  accessibility: "Accessibility",
  performance: "Performance",
  visual_hierarchy: "Visual Hierarchy",
  navigation: "Navigation & IA",
  forms: "Forms",
  content_quality: "Content Quality",
  mobile: "Mobile",
  cta: "CTA",
};

function getScoreColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 75) return "#84cc16";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Poor";
  return "Critical";
}

interface GaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

function ScoreGauge({ score, size = 80, strokeWidth = 7 }: GaugeProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = getScoreColor(score);

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#1f2937"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: "stroke-dashoffset 1s ease-out",
        }}
      />
    </svg>
  );
}

interface OverallScoreProps {
  score: number;
}

export function OverallScore({ score }: OverallScoreProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1f2937"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-white">{score}</span>
          <span className="text-sm text-gray-400">/100</span>
        </div>
      </div>
      <span className="text-lg font-semibold" style={{ color }}>
        {label}
      </span>
      <span className="text-sm text-gray-500">Overall UX Score</span>
    </div>
  );
}

interface ScoreOverviewProps {
  overallScore: number;
  categoryScores: CategoryScore[];
}

export function ScoreOverview({ overallScore, categoryScores }: ScoreOverviewProps) {
  const sorted = [...categoryScores].sort((a, b) => b.weight - a.weight);

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-6">Score Overview</h2>
      <div className="flex flex-col lg:flex-row gap-8 items-center">
        <div className="flex-shrink-0">
          <OverallScore score={overallScore} />
        </div>
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
          {sorted.map((cs) => (
            <div key={cs.category} className="flex flex-col items-center gap-2">
              <div className="relative">
                <ScoreGauge score={cs.score} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-base font-bold text-white">{cs.score}</span>
                </div>
              </div>
              <span className="text-xs text-gray-400 text-center leading-tight">
                {CATEGORY_LABELS[cs.category] ?? cs.category}
              </span>
              <span className="text-xs font-medium" style={{ color: getScoreColor(cs.score) }}>
                {getScoreLabel(cs.score)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
