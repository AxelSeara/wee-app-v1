import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/aura/fixtures.json";
import { classifyPost } from "../lib/classify";

type Fixture = {
  id: string;
  title?: string;
  text?: string;
  url?: string;
  metadata?: {
    publisher?: string;
    author?: string;
    schemaTypes?: string[];
    hasImprintOrContact?: boolean;
    outboundUrls?: string[];
    bodyText?: string;
    hasOverlayPopup?: boolean;
    adLikeNodeRatio?: number;
    publishedAt?: string;
    duplicateSignals?: {
      canonicalExists?: boolean;
      contentHashExists?: boolean;
    };
  };
};

const items = fixtures as Fixture[];
const fixture = (id: string): Fixture => {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`Missing fixture ${id}`);
  return found;
};

describe("aura v2 calibration fixtures", () => {
  it("keeps score ranges in bounds for all fixtures", () => {
    const results = items.map((item) => classifyPost({ ...item, rulesetVersion: "v2", debug: true }, Date.now()));
    results.forEach((result) => {
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
      expect(result.interestScore).toBeGreaterThanOrEqual(1);
      expect(result.interestScore).toBeLessThanOrEqual(100);
      expect(result.debugBreakdown?.quality.adjustments.length ?? 0).toBeGreaterThan(0);
      expect(result.debugBreakdown?.aura.adjustments.length ?? 0).toBeGreaterThan(0);
    });
  });

  it("penalizes obvious clickbait vs reputable baseline", () => {
    const baseline = classifyPost({ ...fixture("f01"), rulesetVersion: "v2" }, Date.now());
    const clickbait = classifyPost({ ...fixture("f02"), rulesetVersion: "v2" }, Date.now());

    expect(clickbait.qualityLabel).toBe("clickbait");
    expect(clickbait.qualityScore).toBeLessThan(baseline.qualityScore);
    expect(clickbait.interestScore).toBeLessThanOrEqual(55);
  });

  it("rewards allowlist + metadata structure", () => {
    const structured = classifyPost({ ...fixture("f14"), rulesetVersion: "v2", debug: true }, Date.now());
    const unknown = classifyPost({ ...fixture("f19"), rulesetVersion: "v2" }, Date.now());

    expect(structured.qualityScore).toBeGreaterThan(unknown.qualityScore);
    expect(structured.debugBreakdown?.quality.firedRules).toContain("v2.schema_news_article");
    expect(structured.debugBreakdown?.quality.firedRules).toContain("v2.publisher_author_contact");
  });

  it("marks duplicate signals and lowers score", () => {
    const canonical = classifyPost({ ...fixture("f16"), rulesetVersion: "v2" }, Date.now());
    const content = classifyPost({ ...fixture("f17"), rulesetVersion: "v2" }, Date.now());

    expect(canonical.flags).toContain("duplicate_canonical");
    expect(content.flags).toContain("duplicate_content");
    expect(content.qualityScore).toBeLessThanOrEqual(canonical.qualityScore);
  });
});
