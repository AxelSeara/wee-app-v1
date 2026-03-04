#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
};

const inputPath = getArg("input", path.resolve("./aura_report_input.json"));
const outputPath = getArg("output", "");
const limit = Number(getArg("limit", "30"));
const format = (getArg("format", "json") || "json").toLowerCase();

const decodeBreakdown = (flags, prefix) => {
  const entry = (flags ?? []).find((flag) => typeof flag === "string" && flag.startsWith(prefix));
  if (!entry) return null;
  const encoded = entry.slice(prefix.length);
  try {
    const json = Buffer.from(encoded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const toTopRules = (breakdown) => {
  if (!breakdown?.adjustments || !Array.isArray(breakdown.adjustments)) return [];
  return [...breakdown.adjustments]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5)
    .map((item) => `${item.ruleId}:${item.delta}`);
};

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const posts = Array.isArray(data?.posts) ? data.posts : Array.isArray(data) ? data : [];

const rows = posts
  .slice()
  .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  .slice(0, Math.max(1, limit))
  .map((post) => {
    const auraBreakdown = decodeBreakdown(post.flags, "aura_breakdown:");
    const qualityBreakdown = decodeBreakdown(post.flags, "quality_breakdown:");
    return {
      id: post.id,
      aura: post.interestScore,
      quality: post.qualityScore,
      domain: post.sourceDomain ?? "unknown",
      title: (post.title ?? "").replace(/\s+/g, " ").trim(),
      labels: [post.qualityLabel, ...(post.flags ?? []).filter((item) => typeof item === "string" && !item.includes("breakdown:"))]
        .filter(Boolean)
        .join("|"),
      top_rules: toTopRules(auraBreakdown),
      top_quality_rules: toTopRules(qualityBreakdown)
    };
  });

let output;
if (format === "csv") {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["id", "aura", "quality", "domain", "title", "labels", "top_rules", "top_quality_rules"].join(",");
  const lines = rows.map((row) =>
    [
      escape(row.id),
      escape(row.aura),
      escape(row.quality),
      escape(row.domain),
      escape(row.title),
      escape(row.labels),
      escape(row.top_rules.join(";")),
      escape(row.top_quality_rules.join(";"))
    ].join(",")
  );
  output = [header, ...lines].join("\n");
} else {
  output = JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2);
}

if (outputPath) {
  fs.writeFileSync(outputPath, output, "utf8");
} else {
  process.stdout.write(output + "\n");
}
