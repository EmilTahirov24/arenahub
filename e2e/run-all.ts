/**
 * Bütün brauzer dəstlərini ardıcıl qaçırır və yekun hesabat verir.
 *
 *   npm run dev      # ayrı terminalda
 *   npm run e2e
 *
 * Bir dəst sınsa da qalanları qaçırılır — məqsəd ilk səhvdə dayanmaq yox, tam
 * mənzərəni görməkdir.
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
  console.log(`${failed.length}/${SUITES.length} dəst keçmədi:`);
  for (const f of failed) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(`Bütün ${SUITES.length} dəst keçdi.`);
