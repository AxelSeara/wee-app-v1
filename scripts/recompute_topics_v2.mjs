#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const topicsCfg = JSON.parse(fs.readFileSync(path.join(root, "config/topics_v2.json"), "utf8"));

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
};

const limit = Math.max(1, Number(getArg("limit", "100")) || 100);
const since = getArg("since", "");

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing envs: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const normalize = (value = "") =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const contains = (text, term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);

const scoreTopics = (post) => {
  const text = normalize(`${post.title ?? ""} ${post.text ?? ""} ${post.url ?? ""}`);
  const scores = new Map();

  Object.entries(topicsCfg.keyword_mappings).forEach(([topic, terms]) => {
    const hits = terms.filter((term) => contains(text, normalize(term))).length;
    if (hits > 0) {
      const current = scores.get(topic) ?? 0;
      scores.set(topic, current + hits * (topicsCfg.weights.keywords.body_keyword ?? 6));
    }
  });

  Object.entries(topicsCfg.url_patterns).forEach(([topic, patterns]) => {
    patterns.forEach((pattern) => {
      try {
        if (new RegExp(pattern, "i").test(post.url ?? "")) {
          scores.set(topic, (scores.get(topic) ?? 0) + (topicsCfg.weights.site_structure.url_pattern ?? 14));
        }
      } catch {
        // ignore invalid regex
      }
    });
  });

  const candidates = [...scores.entries()]
    .map(([topic, score]) => ({ topic, score: Number(score.toFixed(2)) }))
    .sort((a, b) => b.score - a.score);

  if (!candidates.length || candidates[0].score < topicsCfg.thresholds.min_score) {
    return {
      topic_v2: "general",
      topic_candidates_v2: candidates,
      topic_explanation_v2: {
        version: "v2",
        selectedTopics: ["general"],
        ambiguous: false,
        thresholds: { minScore: topicsCfg.thresholds.min_score, delta: topicsCfg.thresholds.delta },
        reasons: [{ signal: "backfill.fallback", topic: "general", weight: 0, evidence: "below_min_score" }]
      }
    };
  }

  const top = candidates[0];
  const second = candidates[1];
  const ambiguous = second ? top.score - second.score < topicsCfg.thresholds.delta : false;
  const selectedTopics = ambiguous ? candidates.slice(0, 2).map((c) => c.topic) : [top.topic];

  return {
    topic_v2: top.topic,
    topic_candidates_v2: candidates,
    topic_explanation_v2: {
      version: "v2",
      selectedTopics,
      ambiguous,
      thresholds: { minScore: topicsCfg.thresholds.min_score, delta: topicsCfg.thresholds.delta },
      reasons: [{ signal: "backfill.heuristic", topic: top.topic, weight: top.score, evidence: "keyword+url" }]
    }
  };
};

const run = async () => {
  let query = supabase
    .from("posts")
    .select("id,title,text,url,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (since) query = query.gte("created_at", `${since}T00:00:00Z`);

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch posts:", error.message);
    process.exit(1);
  }

  const posts = data ?? [];
  for (const post of posts) {
    const computed = scoreTopics(post);
    const { error: updateError } = await supabase
      .from("posts")
      .update({
        topic_v2: computed.topic_v2,
        topic_candidates_v2: computed.topic_candidates_v2,
        topic_explanation_v2: computed.topic_explanation_v2,
        topic_version: "v2"
      })
      .eq("id", post.id);

    if (updateError) {
      console.error(`Failed post ${post.id}:`, updateError.message);
      continue;
    }
    console.log(`Updated ${post.id} -> ${computed.topic_v2}`);
  }

  console.log(`Done. Processed ${posts.length} posts.`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
