import { describe, expect, it } from "vitest";
import { canonicalizeUrl, duplicateUrlKeys } from "../lib/utils";

describe("URL duplicate normalization", () => {
  it("removes tracking params and normalizes host/path", () => {
    const canonical = canonicalizeUrl(
      "https://www.Example.com/news/story/?utm_source=wa&fbclid=abc&id=42#section"
    );
    expect(canonical).toBe("example.com/news/story?id=42");
  });

  it("matches http/https and m. host through duplicate keys", () => {
    const keysA = duplicateUrlKeys("http://m.example.com/path/to/item/?a=1&utm_medium=share");
    const keysB = duplicateUrlKeys("https://example.com/path/to/item?a=1");
    const overlap = keysA.some((key) => keysB.includes(key));
    expect(overlap).toBe(true);
  });

  it("includes relaxed key without query for near-duplicate URLs", () => {
    const keys = duplicateUrlKeys("https://example.com/a/b?foo=1&bar=2");
    expect(keys).toContain("example.com/a/b?bar=2&foo=1");
    expect(keys).toContain("example.com/a/b");
  });
});
