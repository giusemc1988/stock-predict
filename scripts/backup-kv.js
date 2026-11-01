#!/usr/bin/env node
/**
 * Backup Cloudflare KV namespaces (PRACTICE + SETTINGS)
 * Skips keys that hold secrets (API keys, tokens, Telegram config)
 * Usage: node scripts/backup-kv.js [--output-dir ./backups]
 */
import fs from "fs";
import path from "path";
import { execFileSync, execSync } from "child_process";

const outputDir = process.argv[2] === "--output-dir" ? process.argv[3] : "./backups";
const timestamp = new Date().toISOString().split("T")[0];
const backupPath = path.join(outputDir, `backup-${timestamp}`);

// Create output directory
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(backupPath, { recursive: true });

console.log(`📦 Backing up KV to ${backupPath}`);

// Keys that hold secrets are never written to a backup (checked in both namespaces).
// The repo is PUBLIC and run artifacts can be downloaded by any GitHub user, so this list is broad:
// any key name with "key", "token", "secret", "github", "telegram" or "password" in it is never saved
// (brain keys are stored as `brainkey:<provider>`, the Nova GitHub token as `nova:github`).
const sensitivePatterns = [/key/i, /token/i, /secret/i, /github/i, /telegram/i, /password/i, /auth/i, /cred/i];
// Nova's uploaded videos and images are the person's own media (MBs each): never in a public backup.
const privatePatterns = [/^nova:(vid|media):/];
const MAX_VALUE_BYTES = 2 * 1024 * 1024;

export function isSensitive(key) {
  return sensitivePatterns.some((pattern) => pattern.test(key));
}

const NAMESPACES = {
  PRACTICE: "c7406fc64a454ccfa114c6aa39f35c64",
  SETTINGS: "6ca496318670484e99a4a97008d8e0d4",
};

// wrangler 4 syntax: `kv key ...` (the old `kv:key` form fails) and `--remote`
// (without it wrangler reads the empty local store).
function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
  });
}

function backupNamespace(bindingName, fileName) {
  console.log(`  Exporting ${bindingName}...`);
  const id = NAMESPACES[bindingName];
  // a failed list must fail the run, never silently save "{}"
  const keys = JSON.parse(wrangler(["kv", "key", "list", "--namespace-id", id, "--remote"]));
  const data = {};
  let failed = 0;
  for (const key of keys) {
    const name = key.name || key;
    if (isSensitive(name) || privatePatterns.some((p) => p.test(name))) {
      console.log(`    ⊘ Skipping private key: ${name}`);
      continue;
    }
    try {
      const value = wrangler(["kv", "key", "get", name, "--namespace-id", id, "--remote", "--text"]);
      // PRACTICE `state` is the one big value we must keep; anything else this large is media or a cache
      if (Buffer.byteLength(value) > MAX_VALUE_BYTES && !(bindingName === "PRACTICE" && name === "state")) {
        console.log(`    ⊘ Skipping large value: ${name} (${Buffer.byteLength(value)} bytes)`);
        continue;
      }
      data[name] = value;
    } catch (e) {
      failed++;
      console.warn(`    ⚠ Failed to read ${name}: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(backupPath, fileName), JSON.stringify(data, null, 2));
  console.log(`    ✓ Saved ${Object.keys(data).length} of ${keys.length} keys (${failed} failed)`);
  return { keys: keys.length, saved: Object.keys(data).length, failed };
}

// Backup both namespaces
const practice = backupNamespace("PRACTICE", "practice.json");
const settings = backupNamespace("SETTINGS", "settings.json");
if (!practice.saved || !("state" in JSON.parse(fs.readFileSync(path.join(backupPath, "practice.json"), "utf-8")))) {
  console.error("✗ PRACTICE backup has no `state` key: refusing to report success");
  process.exit(1);
}

// Save metadata
const metadata = {
  timestamp: new Date().toISOString(),
  version: JSON.parse(fs.readFileSync("package.json", "utf-8")).version,
  branch: execSync("git rev-parse --abbrev-ref HEAD", {
    encoding: "utf-8",
  }).trim(),
  commit: execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim(),
  counts: { practice, settings },
  note: "Keys holding secrets (API keys, tokens, Telegram config) are excluded. Restore with scripts/restore-kv.js",
};

fs.writeFileSync(
  path.join(backupPath, "metadata.json"),
  JSON.stringify(metadata, null, 2)
);

console.log(`\n✅ Backup complete: ${backupPath}`);
console.log(`   To restore: node scripts/restore-kv.js ${backupPath}`);
