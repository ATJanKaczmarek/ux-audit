import type { PageData } from "@/types/scan";
import { describe, expect, it, vi } from "vitest";
import { detectFlowsWithAI, extractJsonArray, hydrateFlow } from "./ai-flow-detector";
import * as flowDetector from "./flow-detector";

describe("extractJsonArray", () => {
  it("returns [] for empty string", () => {
    expect(extractJsonArray("")).toEqual([]);
  });

  it("parses plain JSON array", () => {
    const json = '[{"type": "login", "pageUrls": ["/login"]}]';
    expect(extractJsonArray(json)).toEqual([{ type: "login", pageUrls: ["/login"] }]);
  });

  it("parses JSON inside markdown code block", () => {
    const text = `Here is the result:
\`\`\`json
[{"type": "signup"}]
\`\`\``;
    expect(extractJsonArray(text)).toEqual([{ type: "signup" }]);
  });

  it("handles JSON with leading/trailing text", () => {
    const text = 'Result: [{"id": 1}] hope this helps';
    expect(extractJsonArray(text)).toEqual([{ id: 1 }]);
  });

  it("returns [] for malformed JSON", () => {
    expect(extractJsonArray("[{ malformed }]")).toEqual([]);
  });
});

describe("hydrateFlow", () => {
  const mockPages: PageData[] = [
    {
      url: "https://example.com/login",
      title: "Login Page",
      depth: 1,
      forms: [],
      links: [],
    } as any,
    {
      url: "https://example.com/dashboard",
      title: "Dashboard",
      depth: 2,
      forms: [],
      links: [],
    } as any,
  ];

  it("coerces unknown flow types to 'unknown'", () => {
    const aiFlow = { type: "invalid-type", pageUrls: ["https://example.com/login"], issues: [] };
    const flow = hydrateFlow(aiFlow, mockPages, {});
    expect(flow?.type).toBe("unknown");
  });

  it("filters out hallucinated URLs", () => {
    const aiFlow = {
      type: "login",
      pageUrls: ["https://example.com/login", "https://hallucinated.com"],
      issues: [],
    };
    const flow = hydrateFlow(aiFlow, mockPages, {});
    expect(flow?.pages).toHaveLength(1);
    expect(flow?.pages[0].url).toBe("https://example.com/login");
  });

  it("returns null for flows with no valid pages", () => {
    const aiFlow = { type: "login", pageUrls: ["https://hallucinated.com"], issues: [] };
    const flow = hydrateFlow(aiFlow, mockPages, {});
    expect(flow).toBeNull();
  });

  it("normalizes URLs by stripping trailing slash", () => {
    const pagesWithSlash: PageData[] = [
      { url: "https://example.com/login/", title: "Login", forms: [], links: [], depth: 1 } as any,
    ];
    const aiFlow = { type: "login", pageUrls: ["https://example.com/login"], issues: [] };
    const flow = hydrateFlow(aiFlow, pagesWithSlash, {});
    expect(flow?.pages).toHaveLength(1);
    expect(flow?.pages[0].url).toBe("https://example.com/login/");
  });
});

describe("detectFlowsWithAI", () => {
  it("early returns [] for empty pages input", async () => {
    const result = await detectFlowsWithAI([], {});
    expect(result).toEqual([]);
  });

  it("falls back to detectFlows when AI call fails", async () => {
    const spy = vi.spyOn(flowDetector, "detectFlows");
    spy.mockReturnValue([{ type: "login" } as any]);

    // This will fail because ANTHROPIC_API_KEY is not set in test env (usually)
    // or we can mock the client if needed.
    // For now, let's assume it fails and calls the fallback.
    const result = await detectFlowsWithAI(
      [{ url: "http://test.com", title: "Test", forms: [], depth: 0 } as any],
      {},
    );

    expect(spy).toHaveBeenCalled();
    expect(result[0].type).toBe("login");
  });
});
