# Feature: Screenshot Capture

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to the exact shape of `PageData`, the Crawlee `requestHandler` callback signature, and the file serving pattern (API route vs. public folder).

## Feature Description

During the crawl phase, capture a JPEG viewport screenshot of each analyzed page and persist it to disk. Surface these screenshots in the per-page accordion inside the report — giving reviewers instant visual context alongside each page's findings, heading structure, and issue list.

Screenshots are captured at the same 1440×900 viewport already set by the crawler, stored as JPEG (quality 60) in `data/screenshots/{scanId}/` alongside `scans.db`, and served on-demand via a new API route. A lightweight SSE event is emitted after each capture so the progress screen can optionally display a "screenshot taken" indicator.

## User Story

As a UX analyst reviewing an audit report
I want to see a screenshot of each crawled page alongside its findings
So that I can visually verify issues and share the report with stakeholders without having to re-open each page in a browser

## Problem Statement

The current report contains per-page data (headings, forms, issues) but no visual context. Reviewers must manually open each URL to understand what the page looks like, which is slow and breaks workflow — especially for large sites or pages behind auth.

## Solution Statement

Integrate Playwright's `page.screenshot()` call into the existing crawler `requestHandler` (after the viewport is already set to 1440×900). Save each screenshot as JPEG at quality 60 to `data/screenshots/{scanId}/{urlHash}.jpg`. Add a dedicated API route to stream these files. Render them in the `PageDetails` accordion header and expanded panel.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**: `crawler.ts`, `scan.ts` (types), `page-details.tsx`, new API route
**Dependencies**: Playwright (already installed v1.50.1), Node.js `fs`, `crypto` (both stdlib)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — **YOU MUST READ THESE BEFORE IMPLEMENTING**

- `src/types/scan.ts` (lines 86–107) — `PageData` interface; add `screenshotPath?: string` before the closing brace
- `src/types/scan.ts` (lines 240–248) — `ScanEvent` union type; add new `screenshot_captured` variant here
- `src/lib/crawler/crawler.ts` (lines 197–270) — `PlaywrightCrawler` config and `requestHandler`; specifically:
  - Line 210: handler signature `{ request, page, enqueueLinks }`
  - Line 215: `await page.setViewportSize({ width: 1440, height: 900 })` — screenshot goes **after** this line
  - Lines 237–258: `PageData` object assembly — add `screenshotPath` field here
  - Lines 305–309: post-crawl cleanup that deletes `/tmp/crawlee-{scanId}` — screenshots live in `data/` not `/tmp/`, so this is unaffected
- `src/lib/scan-engine.ts` (lines 50–57) — crawl step; no changes needed, `screenshotPath` flows through automatically
- `src/lib/aggregator.ts` (lines 25–35, 91–104) — passes `pages: PageData[]` through unchanged; no changes needed
- `src/lib/db.ts` (lines 6, 57–64, 92–100) — `completeScan()` stores full `ScanResult` as JSON; `screenshotPath` fields persist naturally
- `src/components/report/page-details.tsx` (lines 10–124) — accordion component; screenshot `<img>` goes at line 74 (top of expanded panel content, before stats grid)
- `src/app/api/scans/[scanId]/stream/route.ts` — SSE endpoint pattern to mirror for the screenshot event

### New Files to Create

- `src/app/api/screenshots/[scanId]/[file]/route.ts` — streams JPEG files from `data/screenshots/{scanId}/` with proper Content-Type and caching headers
- *(No new library files; all logic fits into existing files)*

### Relevant Documentation — **READ BEFORE IMPLEMENTING**

- [Playwright page.screenshot()](https://playwright.dev/docs/api/class-page#page-screenshot)
  - Specific: `type: 'jpeg'`, `quality: 0-100`, `fullPage: false` (default)
  - **GOTCHA**: `clip` and `fullPage` are mutually exclusive — cannot use both
  - **GOTCHA**: `quality` is ignored for PNG; only applies to JPEG and WebP
  - Returns `Promise<Buffer>` — use `fs.writeFile(path, buffer)` to persist
- [Next.js Route Handlers — Binary Response](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
  - Pattern: `new Response(buffer, { headers: { 'Content-Type': 'image/jpeg' } })`
  - For large files, prefer `fs.open` + `readableWebStream` to avoid loading into memory

### Patterns to Follow

**File I/O Pattern (from `src/lib/db.ts` lines 9–12):**
```typescript
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
```
Mirror this exact pattern to ensure `data/screenshots/{scanId}/` exists before writing.

**URL → filename hashing:**
```typescript
import { createHash } from "crypto";
function urlToFilename(url: string): string {
  return createHash("md5").update(url).digest("hex") + ".jpg";
}
```
Use MD5 of URL as filename — avoids path length issues and special character problems.

**SSE emit pattern (from `src/lib/scan-store.ts` lines 23–39):**
```typescript
emitScanEvent(scanId, { event: "screenshot_captured", url, index, total });
```
Called immediately after `fs.writeFile` succeeds for each page.

**API route binary response (from `src/app/api/scans/[scanId]/stream/route.ts`):**
```typescript
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scanId: string; file: string }> },
): Promise<Response> {
  const { scanId, file } = await params;
  // ...
}
```
Params are always `Promise<...>` in Next.js 15 App Router dynamic routes.

**Crawlee requestHandler timing:** The `page` object is fully navigated and settled before `page.evaluate(PAGE_EVAL_SCRIPT)` runs. Screenshot should be taken **after** `setViewportSize` and **before** `evaluate`, so the viewport is correct and the DOM is rendered but we haven't started expensive JS evaluation yet.

---

## IMPLEMENTATION PLAN

### Phase 1: Types & Storage Foundation

Extend `PageData` with the optional `screenshotPath` field and add the new SSE event type. No runtime behavior changes yet.

**Tasks:**
- Add `screenshotPath?: string` to `PageData` interface
- Add `screenshot_captured` variant to `ScanEvent` union

### Phase 2: Capture & Persist

Integrate `page.screenshot()` into the crawler's `requestHandler`. Write JPEG buffer to disk. Set `screenshotPath` on each `PageData`.

**Tasks:**
- Create screenshot directory helper (reuse `data/` dir pattern)
- Capture viewport JPEG after viewport is set, before DOM evaluation
- Write file, set `pageData.screenshotPath`, emit SSE progress event

### Phase 3: Serve

New API route that reads JPEG files from disk and returns them with correct content-type. Handles 404 gracefully.

**Tasks:**
- Create `src/app/api/screenshots/[scanId]/[file]/route.ts`
- Stream file with `image/jpeg` content-type and 1-hour cache
- Return 404 if file doesn't exist

### Phase 4: Display

Render the screenshot in the `PageDetails` accordion expanded panel. Show a thumbnail in the collapsed header row.

**Tasks:**
- Add screenshot thumbnail to expanded panel (before stats grid)
- Add tiny screenshot preview badge in collapsed row (optional, non-blocking)
- Handle missing screenshot gracefully (don't break pages without screenshots)

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `src/types/scan.ts` — Add `screenshotPath` to PageData

- **ADD**: `screenshotPath?: string;` to `PageData` interface (after `loadedAt: number;` on line 106, before the closing brace on line 107)
- **ADD**: New SSE event variant to `ScanEvent` union (after the `page_analyzed` variant, around line 243):
  ```typescript
  | { event: "screenshot_captured"; index: number; total: number; url: string }
  ```
- **GOTCHA**: Keep `screenshotPath` optional (`?`) — pages where screenshot failed won't have it, and this field didn't exist in historical DB rows
- **VALIDATE**: `npm run build 2>&1 | grep -E "error|Error"` — should produce zero type errors

---

### Task 2: UPDATE `src/lib/crawler/crawler.ts` — Capture Screenshot in requestHandler

- **ADD** top-of-file imports:
  ```typescript
  import { createHash } from "crypto";
  import { writeFile } from "fs/promises";
  import path from "path";
  ```
  (Note: `path` and `fs` are already standard imports — check existing imports before adding duplicates)

- **ADD** screenshot directory helper function before the `crawlSite` export:
  ```typescript
  function getScreenshotDir(scanId: string): string {
    return path.join(process.cwd(), "data", "screenshots", scanId);
  }

  function urlToFilename(url: string): string {
    return createHash("md5").update(url).digest("hex") + ".jpg";
  }
  ```

- **ADD** directory creation at the beginning of `crawlSite()`, after `fs.mkdirSync(storageDir, { recursive: true })` (around line 168):
  ```typescript
  const screenshotDir = getScreenshotDir(scanId);
  fs.mkdirSync(screenshotDir, { recursive: true });
  ```
  (Note: `fs` is already imported as a namespace import — use `fs.mkdirSync`, not the async version)

- **ADD** screenshot capture inside `requestHandler`, **after** `await page.setViewportSize(...)` (line 215) and **before** the `page.evaluate(PAGE_EVAL_SCRIPT)` call:
  ```typescript
  // Capture viewport screenshot
  let screenshotPath: string | undefined;
  try {
    const filename = urlToFilename(url);
    const filepath = path.join(screenshotDir, filename);
    const buffer = await page.screenshot({ type: "jpeg", quality: 60 });
    await writeFile(filepath, buffer);
    screenshotPath = `screenshots/${scanId}/${filename}`;
  } catch (screenshotErr) {
    console.warn(`[crawler] Screenshot failed for ${url}:`, screenshotErr);
  }
  ```

- **UPDATE** `PageData` assembly object (around lines 237–258): Add `screenshotPath` field at the end, before the closing brace:
  ```typescript
  const pageData: PageData = {
    // ... existing fields ...
    loadedAt: Date.now(),
    screenshotPath,   // <-- ADD THIS
  };
  ```

- **ADD** SSE event emit after `pages.push(pageData)` (currently at line 260):
  ```typescript
  // (The onProgress callback is already called a few lines later)
  // The screenshot_captured event is emitted by scan-engine, not directly from crawler
  // — no change needed here unless you want per-page thumbnail streaming
  ```
  **DECISION**: To keep the crawler pure (no scanId or emitScanEvent dependency), the `screenshot_captured` SSE event is **not** emitted from the crawler. If live thumbnail streaming is desired, pass an `onScreenshot` callback to `crawlSite` (same pattern as existing `onProgress`). For now, skip this — the screenshots are visible in the report, which is the core requirement.

- **GOTCHA**: `screenshotDir` is defined in the outer `crawlSite` scope but used inside the `requestHandler` closure — this is intentional and works because `requestHandler` closes over `screenshotDir`.
- **GOTCHA**: The `writeFile` import must use `"fs/promises"` not `"fs"` to get the Promise-based version. Alternatively use `fs.writeFileSync` to stay consistent with the existing synchronous `fs` usage pattern in this file (check: the existing `fs.mkdirSync` calls use the synchronous `fs` module, so `fs.writeFileSync(filepath, buffer)` is more consistent and avoids mixing sync/async patterns).
- **VALIDATE**: `npm run build 2>&1 | grep -E "error|Error"` — zero TypeScript errors

---

### Task 3: CREATE `src/app/api/screenshots/[scanId]/[file]/route.ts` — Serve Screenshot Files

- **CREATE** the directory: `src/app/api/screenshots/[scanId]/[file]/`
- **IMPLEMENT** the route:
  ```typescript
  import { NextRequest } from "next/server";
  import path from "path";
  import fs from "fs";

  export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ scanId: string; file: string }> },
  ): Promise<Response> {
    const { scanId, file } = await params;

    // Sanitize: only allow hex filenames with .jpg extension
    if (!/^[a-f0-9]{32}\.jpg$/.test(file)) {
      return new Response("Not Found", { status: 404 });
    }

    const filepath = path.join(process.cwd(), "data", "screenshots", scanId, file);

    if (!fs.existsSync(filepath)) {
      return new Response("Not Found", { status: 404 });
    }

    const buffer = fs.readFileSync(filepath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, immutable",
        "Content-Length": buffer.length.toString(),
      },
    });
  }
  ```
- **PATTERN**: Params destructuring mirrors `src/app/api/scans/[scanId]/route.ts` (line 8: `{ params }: { params: Promise<{ scanId: string }> }`)
- **SECURITY**: The filename regex `/^[a-f0-9]{32}\.jpg$/` ensures only valid MD5-hash filenames are served — prevents path traversal attacks
- **GOTCHA**: `params` is `Promise<...>` in Next.js 15 App Router — must `await params` before destructuring
- **GOTCHA**: `scanId` from the route params must also be sanitized if used in a path — UUIDs only contain hex chars and hyphens, which is safe, but add a UUID regex if desired
- **VALIDATE**: `curl -I http://localhost:3000/api/screenshots/test-id/abc123.jpg` — should return 404 (file doesn't exist yet, but route is reachable)

---

### Task 4: UPDATE `src/components/report/page-details.tsx` — Display Screenshots

- **UPDATE** the `PageData` import (top of file) — no change needed, TypeScript will pick up the new optional field automatically
- **ADD** screenshot image in the expanded panel. Locate the `{expanded && (` block (around line 78). Insert **before** the stats grid:
  ```tsx
  {isExpanded && (
    <div className="px-4 pb-4 space-y-4 border-t border-gray-800/50">
      {/* Screenshot thumbnail — ADD THIS BLOCK at the top */}
      {page.screenshotPath && (
        <div className="pt-3">
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <img
              src={`/api/${page.screenshotPath}`}
              alt={`Screenshot of ${page.title}`}
              className="w-full object-cover object-top max-h-48"
              loading="lazy"
            />
          </a>
        </div>
      )}
      {/* existing stats grid, heading structure, issues — unchanged */}
      ...
    </div>
  )}
  ```

  **NOTE on the `src` URL**: `page.screenshotPath` stores `"screenshots/{scanId}/{filename}.jpg"`, and the API route is at `/api/screenshots/{scanId}/{file}`. So the `src` must be `/api/${page.screenshotPath}`.

- **OPTIONAL** Add tiny thumbnail in the collapsed row header (the `<button>` at line 29):
  ```tsx
  {/* After the title/subtitle div, before the flex-shrink-0 stats */}
  {page.screenshotPath && (
    <div className="w-16 h-10 flex-shrink-0 overflow-hidden rounded border border-gray-800 hidden sm:block">
      <img
        src={`/api/${page.screenshotPath}`}
        alt=""
        className="w-full h-full object-cover object-top"
        loading="lazy"
      />
    </div>
  )}
  ```

- **GOTCHA**: Do NOT use Next.js `<Image>` component here — it requires `remotePatterns` config for external domains or special handling for local API routes, and adds unnecessary complexity. Plain `<img>` is correct for same-origin dynamic paths.
- **GOTCHA**: `object-top` CSS class ensures the screenshot shows the top of the page (above-fold content), not the center — this is important for screenshots that get cropped by `max-h-48`
- **VALIDATE**: `npm run build` — zero errors; open report page in browser and verify screenshots display

---

### Task 5: UPDATE `.gitignore` — Exclude Screenshots from Version Control

- **ADD** to `.gitignore`:
  ```
  data/screenshots/
  ```
  (The `data/` directory is already gitignored, so this may already be covered — verify)
- **VALIDATE**: `cat .gitignore | grep screenshots` — should show the entry

---

## TESTING STRATEGY

### Unit Tests

The screenshot capture is I/O and browser-dependent — not suitable for pure unit tests. The utility functions can be tested:

**CREATE** `src/lib/crawler/crawler.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

// Test the URL → filename hashing logic (extract to testable helper)
describe("urlToFilename", () => {
  it("produces 32-char hex + .jpg", () => {
    const hash = createHash("md5").update("https://example.com/page").digest("hex");
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
    expect(`${hash}.jpg`).toHaveLength(36);
  });

  it("produces different hashes for different URLs", () => {
    const h1 = createHash("md5").update("https://a.com").digest("hex");
    const h2 = createHash("md5").update("https://b.com").digest("hex");
    expect(h1).not.toBe(h2);
  });
});
```

**Note**: Export `urlToFilename` from `crawler.ts` or move to a `src/lib/crawler/utils.ts` helper file to make it testable.

### Integration Tests

Manual end-to-end validation (see Validation Commands below).

### Edge Cases to Handle

- **Screenshot times out** during crawl: Wrap in `try/catch`, leave `screenshotPath: undefined`; page still appears in report without image
- **Screenshot file deleted** between scan and report view: API route returns 404; `<img>` element shows a broken image — acceptable, or add `onError` handler to hide it
- **Zero-size screenshot** (blank page): File is written, shows blank white image in report — acceptable
- **Very large pages** causing memory issues with `fullPage: true`: We use `fullPage: false` (default) to avoid this entirely
- **`quality: 60`** may produce visible artifacts on pages with many gradients — acceptable tradeoff for 50% file size savings vs quality 80

---

## VALIDATION COMMANDS

### Level 1: TypeScript Compilation

```bash
npm run build 2>&1 | grep -E "error TS|Error"
```
Expected: Zero output (no TypeScript errors).

### Level 2: Unit Tests

```bash
npm run test:run
```
Expected: All 14+ tests pass (existing + new URL hash tests).

### Level 3: Dev Server + Route Sanity

```bash
# Start dev server
npm run dev &
sleep 5

# Test screenshot route returns 404 for non-existent file (not 500)
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/api/screenshots/fake-id/abc123.jpg"
# Expected: 404

# Test path traversal is blocked
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/api/screenshots/fake-id/../../scans.db"
# Expected: 404 (rejected by filename regex before filesystem access)
```

### Level 4: End-to-End Scan

```bash
# Start a real scan (replace with any small site)
SCAN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/scans \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}')
SCAN_ID=$(echo "$SCAN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['scanId'])")
echo "Scan ID: $SCAN_ID"

# Wait for completion (check status periodically)
sleep 30
curl -s "http://localhost:3000/api/scans/$SCAN_ID" | python3 -m json.tool | grep status

# Verify screenshot files were created on disk
ls -la data/screenshots/$SCAN_ID/

# Verify a screenshot can be fetched via API
FIRST_FILE=$(ls data/screenshots/$SCAN_ID/ | head -1)
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/api/screenshots/$SCAN_ID/$FIRST_FILE"
# Expected: 200
```

### Level 5: Visual Validation

1. Open `http://localhost:3000` in browser
2. Submit `https://example.com` for a scan
3. Wait for scan to complete and redirect to report
4. Scroll to "Page Details" section
5. Expand first page accordion
6. **Verify**: Screenshot of `https://example.com` is visible at top of expanded panel
7. **Verify**: Image shows the above-fold content of the page
8. **Verify**: Image is clickable and opens the URL

---

## ACCEPTANCE CRITERIA

- [ ] `page.screenshot()` is called inside `requestHandler` after viewport is set
- [ ] Screenshots are saved to `data/screenshots/{scanId}/{md5hash}.jpg` as JPEG at quality 60
- [ ] `PageData.screenshotPath` is set to `"screenshots/{scanId}/{filename}.jpg"` (relative path)
- [ ] API route `GET /api/screenshots/[scanId]/[file]` serves files with `Content-Type: image/jpeg`
- [ ] Filename validation regex prevents path traversal attacks
- [ ] Screenshots are visible in expanded page accordion in the report
- [ ] Pages without screenshots (capture failed) render without errors in the report
- [ ] `npm run build` produces zero TypeScript errors
- [ ] `npm run test:run` — all tests pass
- [ ] `data/screenshots/` is gitignored

---

## COMPLETION CHECKLIST

- [ ] Task 1 completed: `PageData.screenshotPath` and `ScanEvent` updated in `scan.ts`
- [ ] Task 2 completed: `crawler.ts` captures JPEG screenshots, sets `screenshotPath` on each page
- [ ] Task 3 completed: API route created and serves files correctly
- [ ] Task 4 completed: `page-details.tsx` shows screenshot in expanded panel
- [ ] Task 5 completed: `.gitignore` updated
- [ ] All validation commands pass
- [ ] End-to-end test: scan a real site, screenshots appear in report

---

## NOTES

**Why viewport-only, not full-page?**
`fullPage: false` (the default) captures only the 1440×900 viewport. Full-page screenshots can be 5-10x larger in file size for long-scroll pages and take significantly longer to generate. The above-fold view is the most relevant for UX analysis (CTA position, visual hierarchy) and maps directly to what auditors care about.

**Why quality 60?**
JPEG at 60 quality reduces file size by ~75% vs. quality 90 with minimal perceptible difference for thumbnail previews. At 1440×900, quality 60 produces files of ~60–120 KB each. For 50 pages, that's ~3–6 MB of screenshots per scan — manageable on disk, fast to serve.

**Why MD5 hash for filenames?**
URLs contain characters unsafe for filenames (`/`, `?`, `&`, `=`, `:`). Hashing produces a clean 32-char hex filename, is collision-resistant at this scale, and avoids filename length limits.

**Why not store screenshots in the database?**
Even at quality 60, 50 screenshots ≈ 5 MB of binary data encoded as base64 ≈ ~7 MB of JSON. This would make the `result_json` column enormous, bloat SQLite write operations, and make the API response for `GET /api/scans/[scanId]` very slow. Disk files + API route is the correct pattern.

**Why not Next.js `<Image>` component?**
`next/image` requires either a static `src` or a configured `remotePatterns` in `next.config.ts`. Our screenshot paths are dynamic and same-origin API routes — using `<img>` with `loading="lazy"` is simpler and sufficient.

**Confidence Score: 9/10**
The integration points are well-understood. Playwright's `page` object is available at the exact moment we need it. The only risk is timing: if `page.screenshot()` adds noticeable latency to the crawl (typically ~200-500ms per page), the overall scan duration increases by ~15–25 seconds for 50 pages. This is acceptable.
