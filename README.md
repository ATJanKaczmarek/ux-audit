# UX Audit Tool

A powerful, automated UX analysis engine that crawls websites to provide comprehensive audits on accessibility, performance, visual hierarchy, navigation, and more—enhanced by AI-powered insights.

![UX Audit Tool](https://images.unsplash.com/photo-1586717791821-3f44a563eb4c?q=80&w=2070&auto=format&fit=crop)

## 🚀 Features

- **Comprehensive Scanning:** Automatically crawls your site to identify pages and their relationships.
- **Multi-Category Audits:**
  - ♿ **Accessibility:** WCAG 2.2 AA compliance checks via `axe-core`.
  - ⚡ **Performance:** Core Web Vitals and performance metrics via `Lighthouse`.
  - 📐 **Visual Hierarchy:** Analysis of headings, font sizes, and contrast.
  - 🧭 **Navigation:** IA depth, orphan pages, and breadcrumb detection.
  - 📝 **Forms:** Evaluation of labels, input types, and submission UX.
  - 📖 **Readability:** Flesch-Kincaid grade level and content complexity.
  - 📱 **Mobile:** Viewport configuration and touch target sizing.
  - 🎯 **CTA Effectiveness:** Action verb analysis, positioning, and density.
- **AI-Powered Insights:** Uses Claude (Anthropic API) to detect user flows and provide strategic UX recommendations.
- **Interactive Reports:** Visualize your site's structure with flow diagrams and drill down into specific findings per page.
- **Real-time Progress:** Watch the scan happen in real-time with live status updates.

## 🛠️ Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, TypeScript)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Database:** [SQLite](https://www.sqlite.org/) (via `better-sqlite3`)
- **Crawling & Automation:** [Crawlee](https://crawlee.dev/) & [Playwright](https://playwright.dev/)
- **Analysis Tools:** `axe-core`, `Lighthouse`, `text-readability`
- **Visualization:** [@xyflow/react](https://reactflow.dev/) (React Flow)
- **AI:** [Anthropic SDK](https://www.npmjs.com/package/@anthropic-ai/sdk) (Claude 3.5 Sonnet)
- **Linting/Formatting:** [Biome](https://biomejs.dev/)

## 🏁 Getting Started

### Prerequisites

- Node.js 20+
- Anthropic API Key (optional, for AI insights)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd ux-audit
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Copy `.env.example` to `.env` and add your API keys:
   ```bash
   cp .env.example .env
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📖 Usage

1. Enter a starting URL on the home page.
2. Wait for the crawler to discover pages (max 15 minutes or configured limit).
3. Review the generated report which includes an overall UX score and category-specific breakdowns.
4. Explore the **Flow Map** to see how users navigate through your site.
5. Read **AI Insights** for high-level strategic improvements.

## 🧪 Testing

Run the test suite using Vitest:
```bash
npm test
```

## 🧹 Linting & Formatting

This project uses Biome for fast linting and formatting:
```bash
npm run lint    # Check for issues
npm run format  # Fix formatting issues
```

## 📄 License

This project is private and for internal use.
