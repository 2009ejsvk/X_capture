import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const ignoredDirectories = new Set([".git", ".vs", "node_modules", "vendor"]);
const root = process.cwd();

function collectJavaScriptFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }

    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectJavaScriptFiles(fullPath));
      continue;
    }

    if (/\.(?:js|mjs)$/i.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = collectJavaScriptFiles(root);
let failed = false;

for (const file of files) {
  const displayPath = relative(root, file);
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout);
  } else {
    process.stdout.write(`ok ${displayPath}\n`);
  }
}

if (failed) {
  process.exitCode = 1;
}
