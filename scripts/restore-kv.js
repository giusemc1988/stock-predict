#!/usr/bin/env node
/**
 * Restore Cloudflare KV data from backup
 * Usage: node scripts/restore-kv.js <backup-dir> [--namespace PRACTICE|SETTINGS|all]
 *
 * Example:
 *   node scripts/restore-kv.js ./backups/backup-2026-10-17
 *   node scripts/restore-kv.js ./backups/backup-2026-10-17 --namespace PRACTICE
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const backupDir = process.argv[2];
const namespaceArg = process.argv[3] === "--namespace" ? process.argv[4] : "all";

if (!backupDir) {
  console.error("Usage: node scripts/restore-kv.js <backup-dir> [--namespace PRACTICE|SETTINGS|all]");
  process.exit(1);
}

if (!fs.existsSync(backupDir)) {
  console.error(`❌ Backup directory not found: ${backupDir}`);
  process.exit(1);
}

// Read metadata
const metadataPath = path.join(backupDir, "metadata.json");
let metadata = {};
if (fs.existsSync(metadataPath)) {
  metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
  console.log(`📋 Backup info:`);
  console.log(`   Date: ${metadata.timestamp}`);
  console.log(`   Version: ${metadata.version}`);
  console.log(`   Commit: ${metadata.commit}`);
  console.log(`   Note: ${metadata.note}`);
}

const namespaceConfig = {
  PRACTICE: "c7406fc64a454ccfa114c6aa39f35c64",
  SETTINGS: "6ca496318670484e99a4a97008d8e0d4",
};

async function restoreNamespace(bindingName) {
  const fileName = `${bindingName.toLowerCase()}.json`;
  const filePath = path.join(backupDir, fileName);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠ No backup file found: ${fileName}`);
    return;
  }

  console.log(`\n📥 Restoring ${bindingName}...`);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const namespaceId = namespaceConfig[bindingName];
  let successCount = 0;
  let skipCount = 0;

  for (const [key, value] of Object.entries(data)) {
    try {
      // Wrangler set requires a file or stdin
      // Save value to temp file and restore
      const tempFile = `.kv-restore-${bindingName}-${Date.now()}.tmp`;
      fs.writeFileSync(tempFile, value);

      execSync(
        `npx wrangler kv:key put "${key}" --path "${tempFile}" --namespace-id ${namespaceId}`,
        { stdio: "pipe" }
      );

      fs.unlinkSync(tempFile);
      successCount++;
    } catch (e) {
      console.warn(`  ⚠ Failed to restore ${key}: ${e.message}`);
      skipCount++;
    }
  }

  console.log(`  ✓ Restored ${successCount} keys` + (skipCount > 0 ? `, skipped ${skipCount}` : ""));
}

// Restore namespaces
if (namespaceArg === "all" || namespaceArg === "PRACTICE") {
  await restoreNamespace("PRACTICE");
}
if (namespaceArg === "all" || namespaceArg === "SETTINGS") {
  await restoreNamespace("SETTINGS");
}

console.log(`\n✅ Restore complete`);
console.log(`   Check your settings at https://stock-predict.chanhmn1011.workers.dev`);
