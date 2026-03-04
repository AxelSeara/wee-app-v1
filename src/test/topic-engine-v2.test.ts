import { describe, expect, it } from "vitest";
import cases from "./fixtures/topic_v2/cases.json";
import { runTopicEngineV2 } from "../lib/topicEngineV2";
import type { ClassifyInput } from "../lib/types";

type TopicCase = {
  id: string;
  input: ClassifyInput;
  expectedTopic?: string;
  expectAmbiguous?: boolean;
};

const fixtures = cases as TopicCase[];

describe("topic engine v2", () => {
  it("assigns expected topic on representative fixtures", () => {
    fixtures
      .filter((item) => item.expectedTopic)
      .forEach((item) => {
        const result = runTopicEngineV2(item.input);
        expect(result.topic).toBe(item.expectedTopic);
      });
  });

  it("respects min score fallback to general", () => {
    const lowSignal = fixtures.find((item) => item.id === "t17");
    if (!lowSignal) throw new Error("missing fixture t17");
    const result = runTopicEngineV2(lowSignal.input);
    expect(result.topic).toBe("general");
    expect(result.explanation.selectedTopics).toEqual(["general"]);
  });

  it("marks ambiguous when top candidates are too close", () => {
    const sample = fixtures.find((item) => item.id === "t20");
    if (!sample) throw new Error("missing fixture t20");
    const result = runTopicEngineV2(sample.input);
    expect(result.explanation.ambiguous).toBe(true);
    expect(result.selectedTopics.length).toBeGreaterThanOrEqual(2);
  });

  it("produces stable explanation payload", () => {
    const sample = fixtures.find((item) => item.id === "t03");
    if (!sample) throw new Error("missing fixture t03");
    const result = runTopicEngineV2(sample.input);

    expect({
      topic: result.topic,
      selectedTopics: result.explanation.selectedTopics,
      ambiguous: result.explanation.ambiguous,
      topSignals: result.explanation.reasons.slice(0, 3).map((reason) => reason.signal)
    }).toMatchInlineSnapshot(`
      {
        "ambiguous": false,
        "selectedTopics": [
          "tech",
        ],
        "topSignals": [
          "keywords.title",
          "url.pattern",
          "conflict.apple_tech.boost",
        ],
        "topic": "tech",
      }
    `);
  });
});
