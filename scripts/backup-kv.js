#!/usr/bin/env node
/**
 * Backup Cloudflare KV namespaces (PRACTICE + SETTINGS)
 * Filters out sensitive data (API keys) since repo is public
 * Usage: node scripts/backup-kv.js [--output-dir ./backups]
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const outputDir = process.argv[2] === "--output-dir" ? process.argv[3] : "./backups";
const timestamp = new Date().toISOString().split("T")[0];
const backupPath = path.join(outputDir, `backup-${timestamp}`);

// Create output directory
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(backupPath, { recursive: true });

console.log(`📦 Backing up KV to ${backupPath}`);

// List of sensitive keys in SETTINGS to exclude
const sensitivePatterns = [
  /gemini.*key/i,
  /groq.*key/i,
  /nvidia.*key/i,
  /grok.*key/i,
  /alpaca.*key/i,
  /alpha.*vantage.*key/i,
  /api.*key/i,
  /secret/i,
];

function isSensitive(key) {
  return sensitivePatterns.some((pattern) => pattern.test(key));
}

async function backupNamespace(bindingName, fileName) {
  console.log(`  Exporting ${bindingName}...`);

  try {
    // Use wrangler kv:key list to get all keys
    const listCmd = `npx wrangler kv:key list --namespace-id ${bindingName === "PRACTICE" ? "c7406fc64a454ccfa114c6aa39f35c64" : "6ca496318670484e99a4a97008d8e0d4"} 2>/dev/null || echo "[]"`;
    const keysOutput = execSync(listCmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const keys = JSON.parse(keysOutput);
    const data = {};

    for (const key of keys) {
      const name = key.name || key;

      // Skip sensitive keys in SETTINGS
      if (bindingName === "SETTINGS" && isSensitive(name)) {
        console.log(`    ⊘ Skipping sensitive key: ${name}`);
        continue;
      }

      try {
        const getCmd = `npx wrangler kv:key get "${name}" --namespace-id ${bindingName === "PRACTICE" ? "c7406fc64a454ccfa114c6aa39f35c64" : "6ca496318670484e99a4a97008d8e0d4"}`;
        const value = execSync(getCmd, { encoding: "utf-8" }).trim();
        data[name] = value;
      } catch (e) {
        console.warn(`    ⚠ Failed to read ${name}: ${e.message}`);
      }
    }

    fs.writeFileSync(
      path.join(backupPath, fileName),
      JSON.stringify(data, null, 2)
    );
    console.log(`    ✓ Saved ${Object.keys(data).length} keys`);
  } catch (err) {
    console.error(`  ✗ Error backing up ${bindingName}: ${err.message}`);
    fs.writeFileSync(path.join(backupPath, fileName), "{}");
  }
}

// Backup both namespaces
await backupNamespace("PRACTICE", "practice.json");
await backupNamespace("SETTINGS", "settings.json");

// Save metadata
const metadata = {
  timestamp: new Date().toISOString(),
  version: JSON.parse(fs.readFileSync("package.json", "utf-8")).version,
  branch: execSync("git rev-parse --abbrev-ref HEAD", {
    encoding: "utf-8",
  }).trim(),
  commit: execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim(),
  note: "SETTINGS excludes API keys (repo is public). Restore with scripts/restore-kv.js",
};

fs.writeFileSync(
  path.join(backupPath, "metadata.json"),
  JSON.stringify(metadata, null, 2)
);

console.log(`\n✅ Backup complete: ${backupPath}`);
console.log(`   To restore: node scripts/restore-kv.js ${backupPath}`);
