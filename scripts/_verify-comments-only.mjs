/**
 * Proves a translation pass touched nothing but comments.
 *
 * 73 of the 113 files carrying Azerbaijani comments also carry the interface's
 * own Azerbaijani strings, and those are the product. Translating one by
 * accident breaks the site without breaking a test - the same trap the e2e
 * selectors set earlier. Reading carefully is not a control; this is.
 *
 *   node scripts/_verify-comments-only.mjs [gitRef]
 *
 * Reads `git diff <ref>` and fails if any changed line is not a comment.
 * Temporary tooling for the translation work; delete when it is finished.
 */
import { execSync } from "node:child_process";

const ref = process.argv[2] ?? "HEAD";
const diff = execSync(`git diff -U0 ${ref}`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const isComment = (line) => {
  const t = line.slice(1).trim();
  if (t === "") return true; // a blank line inside a reflowed block
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("*/");
};

let file = "";
const offenders = [];
let changed = 0;

for (const line of diff.split("\n")) {
  if (line.startsWith("+++ b/")) {
    file = line.slice(6);
    continue;
  }
  if (line.startsWith("---") || line.startsWith("+++")) continue;
  if (!line.startsWith("+") && !line.startsWith("-")) continue;
  changed++;
  if (!isComment(line)) offenders.push(`${file}\n    ${line.slice(0, 120)}`);
}

console.log(`changed lines: ${changed}`);
if (offenders.length) {
  console.log(`\nNOT A COMMENT (${offenders.length}):\n`);
  for (const o of offenders.slice(0, 40)) console.log("  " + o);
  process.exit(1);
}
console.log("every changed line is a comment.");
