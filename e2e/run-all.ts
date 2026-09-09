/**
 * Runs every browser suite in turn and prints one final report.
 *
 *   npm run dev      # in another terminal
 *   npm run e2e
 *
 * A failing suite does not stop the others: the point is the whole picture, not
 * halting at the first error.
 */
import { spawnSync } from "node:child_process";

const SUITES = ["e2e/01-smoke.ts", "e2e/02-lifecycle.ts", "e2e/03-player.ts", "e2e/04-admin.ts", "e2e/05-claim.ts", "e2e/06-widgets.ts"];

const failed: string[] = [];
for (const suite of SUITES) {
  console.log(`\n${"═".repeat(60)}\n${suite}\n${"═".repeat(60)}`);
  const res = spawnSync("npx", ["tsx", suite], { stdio: "inherit", shell: true });
  if (res.status !== 0) failed.push(suite);
}

console.log(`\n${"═".repeat(60)}`);
if (failed.length) {
  console.log(`${failed.length}/${SUITES.length} suites failed:`);
  for (const f of failed) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(`All ${SUITES.length} suites passed.`);
