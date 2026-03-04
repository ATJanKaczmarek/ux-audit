import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { urlToFilename } from "./crawler";

describe("urlToFilename", () => {
  it("produces a 32-char hex string followed by .jpg", () => {
    const result = urlToFilename("https://example.com/page");
    expect(result).toMatch(/^[a-f0-9]{32}\.jpg$/);
    expect(result).toHaveLength(36); // 32 hex chars + ".jpg"
  });

  it("produces different hashes for different URLs", () => {
    const a = urlToFilename("https://example.com/about");
    const b = urlToFilename("https://example.com/contact");
    expect(a).not.toBe(b);
  });

  it("produces the same hash for the same URL (deterministic)", () => {
    const url = "https://stripe.com/pricing";
    expect(urlToFilename(url)).toBe(urlToFilename(url));
  });

  it("produces a valid MD5 hash matching manual computation", () => {
    const url = "https://example.com";
    const expected = createHash("md5").update(url).digest("hex") + ".jpg";
    expect(urlToFilename(url)).toBe(expected);
  });

  it("handles URLs with query strings and fragments safely", () => {
    const result = urlToFilename("https://example.com/search?q=hello&page=1#results");
    expect(result).toMatch(/^[a-f0-9]{32}\.jpg$/);
  });
});
