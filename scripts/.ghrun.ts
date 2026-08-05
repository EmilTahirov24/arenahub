import { execFileSync } from "node:child_process";

const REPO = "EmilTahirov24/arenahub";
const WORKFLOW = "import-live.yml";

function githubToken(): string {
  const out = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
  });
  const line = out.split(/\r?\n/).find((l) => l.startsWith("password="));
  if (!line) throw new Error("credential helper returned no password");
  return line.slice("password=".length);
}

const token = githubToken();
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "arenahub-setup",
};

const api = (path: string, init: RequestInit = {}) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });

(async () => {
  const before = await (await api("/actions/runs?per_page=1")).json();
  const lastId = before.workflow_runs?.[0]?.id ?? 0;

  const go = await api(`/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main" }),
  });
  console.log(`işə salındı — HTTP ${go.status}`);
  if (go.status !== 204) {
    console.log(await go.text());
    process.exit(1);
  }

  // The run does not exist the instant the dispatch returns.
  let runId = 0;
  for (let i = 0; i < 20 && !runId; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const runs = await (await api("/actions/runs?per_page=3")).json();
    const fresh = runs.workflow_runs?.find((r: { id: number }) => r.id !== lastId);
    if (fresh) runId = fresh.id;
  }
  if (!runId) {
    console.log("gediş görünmədi");
    process.exit(1);
  }
  console.log(`gediş: https://github.com/${REPO}/actions/runs/${runId}\n`);

  let status = "";
  let conclusion: string | null = null;
  for (let i = 0; i < 100; i++) {
    const run = await (await api(`/actions/runs/${runId}`)).json();
    if (run.status !== status) {
      status = run.status;
      console.log(`  ${new Date().toISOString().slice(11, 19)}  ${status}`);
    }
    if (run.status === "completed") {
      conclusion = run.conclusion;
      break;
    }
    await new Promise((r) => setTimeout(r, 10000));
  }

  console.log(`\nnəticə: ${conclusion ?? "hələ bitməyib"}`);

  const jobs = await (await api(`/actions/runs/${runId}/jobs`)).json();
  for (const job of jobs.jobs ?? []) {
    console.log(`\njob ${job.name}: ${job.conclusion}`);
    for (const s of job.steps ?? []) console.log(`  ${s.number}. ${s.name}: ${s.conclusion}`);
  }
})();
