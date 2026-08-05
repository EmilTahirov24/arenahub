/**
 * Adds DATABASE_URL to the repository's Actions secrets.
 *
 * Nothing secret is printed: the token is read straight out of the credential
 * helper into memory, the connection string straight out of .env, and only
 * lengths and statuses reach the console.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import _sodium from "libsodium-wrappers";

const REPO = "EmilTahirov24/arenahub";
const SECRET = "DATABASE_URL";

function githubToken(): string {
  const out = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
  });
  const line = out.split(/\r?\n/).find((l) => l.startsWith("password="));
  if (!line) throw new Error("credential helper returned no password");
  return line.slice("password=".length);
}

function connectionString(): string {
  const env = readFileSync(".env", "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("PRODUCTION_DATABASE_URL="));
  if (!line) throw new Error("PRODUCTION_DATABASE_URL not found in .env");
  return line.slice("PRODUCTION_DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

async function gh(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "arenahub-setup",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

(async () => {
  const token = githubToken();
  console.log(`token alındı (${token.length} simvol)`);

  const value = connectionString();
  console.log(`bağlantı sətri alındı (${value.length} simvol)`);

  const who = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "arenahub-setup" },
  });
  if (!who.ok) {
    console.log(`XƏTA: token qəbul edilmədi — ${who.status}`);
    process.exit(1);
  }
  console.log(`GitHub istifadəçisi: ${(await who.json()).login}`);

  const keyRes = await gh(token, "/actions/secrets/public-key");
  if (!keyRes.ok) {
    console.log(`XƏTA: açar alınmadı — ${keyRes.status} ${await keyRes.text()}`);
    process.exit(1);
  }
  const { key, key_id } = (await keyRes.json()) as { key: string; key_id: string };

  await _sodium.ready;
  const sodium = _sodium;
  const sealed = sodium.crypto_box_seal(
    sodium.from_string(value),
    sodium.from_base64(key, sodium.base64_variants.ORIGINAL),
  );
  const encrypted_value = sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);

  const put = await gh(token, `/actions/secrets/${SECRET}`, {
    method: "PUT",
    body: JSON.stringify({ encrypted_value, key_id }),
  });
  console.log(`sirr yazıldı — HTTP ${put.status}`);
  if (put.status !== 201 && put.status !== 204) {
    console.log(await put.text());
    process.exit(1);
  }

  const list = await gh(token, "/actions/secrets");
  const secrets = (await list.json()) as { secrets: { name: string; updated_at: string }[] };
  console.log("repoda olan sirlər:");
  for (const s of secrets.secrets) console.log(`  ${s.name}  (${s.updated_at})`);
})();
