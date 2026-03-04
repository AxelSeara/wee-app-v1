import { describe, expect, it } from "vitest";
import { classifyPost, detectTopics, normalizeInputText } from "../lib/classify";

describe("classify helpers", () => {
  it("normalizes combined fields", () => {
    const normalized = normalizeInputText({
      title: "  Hello   World  ",
      text: "THIS is text",
      url: "https://example.com"
    });

    expect(normalized).toContain("hello world");
    expect(normalized).toContain("this is text");
  });

  it("detects topics and fallback misc", () => {
    expect(detectTopics("new ai chip and startup funding")).toContain("tech");
    expect(detectTopics("completely unrelated string")).toEqual(["misc"]);
  });

  it("detects additional thematic domains", () => {
    expect(detectTopics("parliament election campaign vote")).toContain("politics");
    expect(detectTopics("hospital vaccine public health update")).toContain("health");
    expect(detectTopics("co2 emissions climate wildfire report")).toContain("climate");
  });
});

describe("classifyPost", () => {
  it("flags clickbait strongly", () => {
    const result = classifyPost({
      title: "URGENTE!!! You won't believe this SHOCK",
      text: "NO VAS A CREER lo que pasó 😱😱😱😱",
      url: "https://random-site.example"
    });

    expect(result.qualityLabel).toBe("clickbait");
    expect(result.flags).toContain("sensational");
    expect(result.interestScore).toBeLessThanOrEqual(60);
  });

  it("scores reputable sources higher", () => {
    const result = classifyPost({
      title: "Reuters report on inflation in 2026",
      text: "According to \"official data\" inflation eased.",
      url: "https://www.reuters.com/world/europe/test"
    });

    expect(result.qualityLabel === "high" || result.qualityLabel === "medium").toBe(true);
    expect(result.qualityScore).toBeGreaterThanOrEqual(70);
    expect(result.sourceDomain).toBe("reuters.com");
  });

  it("penalizes missing source", () => {
    const result = classifyPost({
      title: "Local event in Ourense",
      text: "Community meeting tomorrow"
    });

    expect(result.flags).toContain("no_source");
    expect(result.topics).toContain("local");
  });

  it("uses title as stronger topic signal", () => {
    const result = classifyPost({
      title: "Election results and senate coalition deal",
      text: "small generic summary",
      url: "https://example.com/post"
    });
    expect(result.topics).toContain("politics");
  });

  it("detects subtopics when evidence exists", () => {
    const result = classifyPost({
      title: "NVIDIA unveils new GPU for generative AI models",
      text: "Semiconductor roadmap highlights machine learning acceleration and model weights.",
      url: "https://example.com/ai-chip"
    });
    expect(result.topics).toContain("tech");
    expect(result.subtopics.some((sub) => sub.startsWith("tech/"))).toBe(true);
  });

  it("improves topic detection with phrase and context clues", () => {
    const result = classifyPost({
      title: "Ceasefire talks continue after missile strike near border",
      text: "Leaders discuss security guarantees while military units remain deployed.",
      url: "https://example.com/world/update"
    });
    expect(result.topics).toContain("geopolitics");
    expect(result.topics.some((topic) => topic === "war" || topic === "geopolitics")).toBe(true);
  });
});
